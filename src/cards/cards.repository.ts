import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Card, CardDocument } from './schemas/card.schema';
import { CardBalance, CardBalanceDocument } from './schemas/card-balance.schema';
import { CardEntity } from './entities/card.entity';
import { CardBalanceEntity } from './entities/card-balance.entity';
import { ICard, ICardBalance } from './interfaces/card.interface';
import { CardStatus, CardType } from '@common/constants/card-types';
import { CardQueryDto } from './dto/card-query.dto';

@Injectable()
export class CardsRepository {
  constructor(
    @InjectModel(Card.name)
    private readonly cardModel: Model<CardDocument>,
    @InjectModel(CardBalance.name)
    private readonly cardBalanceModel: Model<CardBalanceDocument>
  ) {}

  /**
   * Create a new card
   */
  async create(cardData: Partial<Card>): Promise<CardEntity> {
    const createdCard = new this.cardModel(cardData);
    const saved = await createdCard.save();
    return new CardEntity(saved.toObject() as unknown as ICard);
  }

  /**
   * Find card by ID
   */
  async findById(cardId: string, includeDeleted: boolean = false): Promise<CardEntity | null> {
    const query: any = { _id: cardId };

    if (!includeDeleted) {
      query.deletedAt = { $exists: false };
    }

    const card = await this.cardModel.findOne(query).lean().exec();
    return card ? new CardEntity(card as unknown as ICard) : null;
  }

  /**
   * Find cards by user and profile with filtering
   */
  async findByUserAndProfile(
    userId: string,
    profileId: string,
    query: CardQueryDto = {},
    includeDeleted: boolean = false
  ): Promise<{ cards: CardEntity[]; total: number }> {
    const filters: any = {
      userId,
      profileId: new Types.ObjectId(profileId)
    };

    if (!includeDeleted) {
      filters.deletedAt = { $exists: false };
    }

    // Apply query filters
    if (query.cardType) {
      filters.cardType = query.cardType;
    }

    if (query.cardBrand) {
      filters.cardBrand = query.cardBrand;
    }

    if (query.status) {
      filters.status = query.status;
    }

    if (query.isDefault !== undefined) {
      filters.isDefault = query.isDefault;
    }

    if (query.search) {
      filters.$or = [{ displayName: { $regex: query.search, $options: 'i' } }, { issuerBank: { $regex: query.search, $options: 'i' } }];
    }

    // Handle expired cards filter
    if (query.isExpired !== undefined) {
      const now = new Date();
      if (query.isExpired) {
        filters.$expr = {
          $and: [
            { $ne: ['$expiryMonth', null] },
            { $ne: ['$expiryYear', null] },
            {
              $lt: [{ $dateFromParts: { year: '$expiryYear', month: '$expiryMonth' } }, now]
            }
          ]
        };
      } else {
        filters.$or = [
          { expiryMonth: { $exists: false } },
          { expiryYear: { $exists: false } },
          {
            $expr: {
              $gte: [{ $dateFromParts: { year: '$expiryYear', month: '$expiryMonth' } }, now]
            }
          }
        ];
      }
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Sorting
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortField]: sortOrder } as any;

    const [cards, total] = await Promise.all([
      this.cardModel.find(filters).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.cardModel.countDocuments(filters).exec()
    ]);

    return {
      cards: cards.map(card => new CardEntity(card as unknown as ICard)),
      total
    };
  }

  /**
   * Find all cards by user
   */
  async findByUser(userId: string, includeDeleted: boolean = false): Promise<CardEntity[]> {
    const query: any = { userId };

    if (!includeDeleted) {
      query.deletedAt = { $exists: false };
    }

    const cards = await this.cardModel.find(query).sort({ isDefault: -1, displayName: 1 }).lean().exec();

    return cards.map(card => new CardEntity(card as unknown as ICard));
  }

  /**
   * Find default card for user and profile
   */
  async findDefaultCard(userId: string, profileId: string): Promise<CardEntity | null> {
    const card = await this.cardModel
      .findOne({
        userId,
        profileId: new Types.ObjectId(profileId),
        isDefault: true,
        status: CardStatus.ACTIVE,
        deletedAt: { $exists: false }
      })
      .lean()
      .exec();

    return card ? new CardEntity(card as unknown as ICard) : null;
  }

  /**
   * Update card
   */
  async update(cardId: string, updateData: Partial<Card>): Promise<CardEntity | null> {
    const updated = await this.cardModel.findByIdAndUpdate(cardId, updateData, { new: true }).lean().exec();

    return updated ? new CardEntity(updated as unknown as ICard) : null;
  }

  /**
   * Set card as default (and unset others)
   */
  async setAsDefault(cardId: string, userId: string, profileId: string): Promise<CardEntity | null> {
    const session = await this.cardModel.db.startSession();

    try {
      await session.withTransaction(async () => {
        // Unset all other default cards for this user/profile
        await this.cardModel.updateMany(
          {
            userId,
            profileId: new Types.ObjectId(profileId),
            isDefault: true,
            deletedAt: { $exists: false }
          },
          { isDefault: false },
          { session }
        );

        // Set the specified card as default
        await this.cardModel.updateOne({ _id: cardId }, { isDefault: true }, { session });
      });

      const updatedCard = await this.cardModel.findById(cardId).lean().exec();
      return updatedCard ? new CardEntity(updatedCard as unknown as ICard) : null;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Soft delete card
   */
  async softDelete(cardId: string, deletedBy: string): Promise<boolean> {
    const result = await this.cardModel
      .updateOne(
        { _id: cardId },
        {
          deletedAt: new Date(),
          deletedBy,
          status: CardStatus.INACTIVE,
          isDefault: false
        }
      )
      .exec();

    return result.modifiedCount > 0;
  }

  /**
   * Check if card name is unique for user/profile
   */
  async isDisplayNameUnique(displayName: string, userId: string, profileId: string, excludeCardId?: string): Promise<boolean> {
    const query: any = {
      userId,
      profileId: new Types.ObjectId(profileId),
      displayName: { $regex: new RegExp(`^${displayName}$`, 'i') },
      deletedAt: { $exists: false }
    };

    if (excludeCardId) {
      query._id = { $ne: excludeCardId };
    }

    const count = await this.cardModel.countDocuments(query).exec();
    return count === 0;
  }

  /**
   * Count cards for user/profile
   */
  async countByUserAndProfile(userId: string, profileId: string): Promise<number> {
    return this.cardModel
      .countDocuments({
        userId,
        profileId: new Types.ObjectId(profileId),
        deletedAt: { $exists: false }
      })
      .exec();
  }

  /**
   * Count cards by type for user
   */
  async countByType(userId: string, cardType: CardType): Promise<number> {
    return this.cardModel
      .countDocuments({
        userId,
        cardType,
        deletedAt: { $exists: false }
      })
      .exec();
  }

  /**
   * Find cards expiring soon
   */
  async findExpiringSoon(userId: string, withinMonths: number = 3): Promise<CardEntity[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + withinMonths);

    const cards = await this.cardModel
      .aggregate([
        {
          $match: {
            userId,
            deletedAt: { $exists: false },
            expiryMonth: { $exists: true },
            expiryYear: { $exists: true }
          }
        },
        {
          $addFields: {
            expiryDate: {
              $dateFromParts: {
                year: '$expiryYear',
                month: '$expiryMonth'
              }
            }
          }
        },
        {
          $match: {
            expiryDate: {
              $gte: now,
              $lte: futureDate
            }
          }
        },
        {
          $sort: { expiryDate: 1 }
        }
      ])
      .exec();

    return cards.map(card => new CardEntity(card));
  }

  /**
   * Get card statistics
   */
  async getStatistics(
    userId: string,
    profileId?: string
  ): Promise<{
    total: number;
    active: number;
    expired: number;
    byType: Record<CardType, number>;
  }> {
    const baseMatch: any = {
      userId,
      deletedAt: { $exists: false }
    };

    if (profileId) {
      baseMatch.profileId = new Types.ObjectId(profileId);
    }

    const now = new Date();

    const [total, active, byType, expired] = await Promise.all([
      this.cardModel.countDocuments(baseMatch).exec(),
      this.cardModel
        .countDocuments({
          ...baseMatch,
          status: CardStatus.ACTIVE
        })
        .exec(),
      this.cardModel.aggregate([{ $match: baseMatch }, { $group: { _id: '$cardType', count: { $sum: 1 } } }]).exec(),
      this.cardModel
        .aggregate([
          {
            $match: {
              ...baseMatch,
              expiryMonth: { $exists: true },
              expiryYear: { $exists: true }
            }
          },
          {
            $addFields: {
              expiryDate: {
                $dateFromParts: {
                  year: '$expiryYear',
                  month: '$expiryMonth'
                }
              }
            }
          },
          {
            $match: {
              expiryDate: { $lt: now }
            }
          },
          {
            $count: 'expired'
          }
        ])
        .exec()
    ]);

    const typeStats = byType.reduce(
      (acc, item) => {
        acc[item._id as CardType] = item.count;
        return acc;
      },
      {} as Record<CardType, number>
    );

    return {
      total,
      active,
      expired: expired[0]?.expired || 0,
      byType: typeStats
    };
  }

  // Card Balance Operations

  /**
   * Create or update card balance
   */
  async upsertBalance(cardId: string, balanceData: Partial<CardBalance>): Promise<CardBalanceEntity> {
    const updated = await this.cardBalanceModel
      .findOneAndUpdate({ cardId: new Types.ObjectId(cardId) }, { ...balanceData, lastUpdated: new Date() }, { new: true, upsert: true })
      .lean()
      .exec();

    return new CardBalanceEntity(updated as unknown as ICardBalance);
  }

  /**
   * Find card balance
   */
  async findBalance(cardId: string): Promise<CardBalanceEntity | null> {
    const balance = await this.cardBalanceModel
      .findOne({ cardId: new Types.ObjectId(cardId) })
      .lean()
      .exec();

    return balance ? new CardBalanceEntity(balance as unknown as ICardBalance) : null;
  }

  /**
   * Find balances by user
   */
  async findBalancesByUser(userId: string): Promise<CardBalanceEntity[]> {
    const balances = await this.cardBalanceModel.find({ userId }).lean().exec();

    return balances.map(balance => new CardBalanceEntity(balance as unknown as ICardBalance));
  }

  /**
   * Find overdue balances
   */
  async findOverdueBalances(userId: string): Promise<CardBalanceEntity[]> {
    const now = new Date();

    const balances = await this.cardBalanceModel
      .find({
        userId,
        paymentDueDate: { $lt: now },
        currentBalance: { $gt: 0 }
      })
      .lean()
      .exec();

    return balances.map(balance => new CardBalanceEntity(balance as unknown as ICardBalance));
  }

  /**
   * Update balance from transaction transaction
   */
  async updateBalanceFromTransaction(cardId: string, amount: number, type: 'DEBIT' | 'CREDIT'): Promise<CardBalanceEntity | null> {
    const adjustment = type === 'DEBIT' ? amount : -amount;

    const updated = await this.cardBalanceModel
      .findOneAndUpdate(
        { cardId: new Types.ObjectId(cardId) },
        {
          $inc: { currentBalance: adjustment },
          $set: { lastUpdated: new Date() }
        },
        { new: true }
      )
      .lean()
      .exec();

    return updated ? new CardBalanceEntity(updated as unknown as ICardBalance) : null;
  }
}
