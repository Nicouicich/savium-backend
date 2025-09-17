import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Expense, ExpenseDocument } from '../../expenses/schemas/expense.schema';
import { Account, AccountDocument } from '../schemas/account.schema';
import { CoupleSettings, CoupleSettingsDocument } from '../schemas/couple-settings.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';

import { CoupleExpenseType, CoupleNotificationType } from '@common/constants/couple-types';
import { AccountType } from '@common/constants/account-types';
import { PaymentMethod } from '@common/constants/expense-categories';

export interface GiftExpenseDto {
  description: string;
  amount: number;
  categoryId: string;
  giftForUserId: string;
  revealDate: Date;
  notes?: string;
  vendor?: string;
  paymentMethod?: string;
  attachedFiles?: string[];
}

export interface GiftExpenseResponseDto {
  id: string;
  description: string;
  amount: number;
  currency: string;
  categoryId: string;
  giftFor: {
    userId: string;
    name: string;
  };
  revealDate: Date;
  isRevealed: boolean;
  revealedAt?: Date;
  createdAt: Date;
  createdBy: {
    userId: string;
    name: string;
  };
}

export interface RevealGiftDto {
  message?: string;
  revealNow?: boolean;
}

@Injectable()
export class GiftModeService {
  constructor(
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
    @InjectModel(CoupleSettings.name)
    private readonly coupleSettingsModel: Model<CoupleSettingsDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>
  ) {}

  /**
   * Type predicate to check if coupleSettingsId is populated
   */
  private isPopulatedCoupleSettings(coupleSettingsId: Types.ObjectId | CoupleSettingsDocument): coupleSettingsId is CoupleSettingsDocument {
    return typeof coupleSettingsId === 'object' && 'accountId' in coupleSettingsId;
  }

  /**
   * Create a gift expense that will be hidden from the recipient until reveal date
   */
  async createGiftExpense(accountId: string, userId: string, giftData: GiftExpenseDto): Promise<GiftExpenseResponseDto> {
    // Verify it's a couple account with gift mode enabled
    const account = await this.accountModel.findById(accountId).populate('coupleSettingsId');
    if (!account || account.type !== AccountType.COUPLE) {
      throw new BadRequestException('Gift mode is only available for couple accounts');
    }

    let coupleSettings: CoupleSettingsDocument | null = null;

    // Check if coupleSettingsId is populated (contains object with schema properties) or just an ObjectId
    if (account.coupleSettingsId && this.isPopulatedCoupleSettings(account.coupleSettingsId)) {
      // It's populated
      coupleSettings = account.coupleSettingsId;
    } else if (account.coupleSettingsId) {
      // It's just an ObjectId, fetch it manually
      coupleSettings = await this.coupleSettingsModel.findById(account.coupleSettingsId);
    }

    if (!coupleSettings?.giftModeEnabled) {
      throw new ForbiddenException('Gift mode is not enabled for this couple account');
    }

    // Verify user has access to the account
    this.verifyUserAccess(account, userId);

    // Verify the gift recipient is the partner in the couple
    const partners = this.getAccountPartners(account);
    if (!partners.includes(giftData.giftForUserId) || giftData.giftForUserId === userId) {
      throw new BadRequestException('Gift can only be created for your partner in the couple');
    }

    // Validate reveal date (must be in the future)
    if (giftData.revealDate <= new Date()) {
      throw new BadRequestException('Gift reveal date must be in the future');
    }

    // Create the expense with gift mode data
    const expense = new this.expenseModel({
      description: giftData.description,
      amount: giftData.amount,
      currency: account.currency || 'USD',
      date: new Date(),
      categoryId: new Types.ObjectId(giftData.categoryId),
      accountId: new Types.ObjectId(accountId),
      userId: userId,
      paymentMethod: giftData.paymentMethod || 'CASH',
      vendor: giftData.vendor,
      notes: giftData.notes,
      fileIds: giftData.attachedFiles || [],
      isSharedExpense: false, // Gift expenses are personal until revealed
      status: 'active',
      coupleData: {
        expenseType: CoupleExpenseType.PERSONAL, // Initially personal
        isGift: true,
        giftFor: giftData.giftForUserId,
        revealDate: giftData.revealDate,
        isRevealed: false,
        comments: [],
        reactions: [],
        isSettled: false
      },
      metadata: {
        source: 'manual',
        parsedContext: 'couple',
        additional: {
          giftMode: true,
          hiddenFromRecipient: true
        }
      }
    });

    await expense.save();

    // Get user details for response
    const createdBy = await this.userModel.findById(userId);
    const giftFor = await this.userModel.findById(giftData.giftForUserId);

    return this.mapToGiftResponseDto(expense, createdBy, giftFor);
  }

  /**
   * Get gift expenses created by user (their gifts for partner)
   */
  async getMyGifts(
    accountId: string,
    userId: string,
    filters?: {
      revealed?: boolean;
      upcoming?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<GiftExpenseResponseDto[]> {
    const account = await this.accountModel.findById(accountId);
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    this.verifyUserAccess(account, userId);

    const query: any = {
      accountId: new Types.ObjectId(accountId),
      userId: userId,
      'coupleData.isGift': true,
      isDeleted: false
    };

    // Apply filters
    if (filters?.revealed !== undefined) {
      query['coupleData.isRevealed'] = filters.revealed;
    }

    if (filters?.upcoming) {
      query['coupleData.revealDate'] = { $gte: new Date() };
      query['coupleData.isRevealed'] = false;
    }

    if (filters?.startDate || filters?.endDate) {
      query['coupleData.revealDate'] = {};
      if (filters.startDate) query['coupleData.revealDate'].$gte = filters.startDate;
      if (filters.endDate) query['coupleData.revealDate'].$lte = filters.endDate;
    }

    const gifts = await this.expenseModel
      .find(query)
      .sort({ 'coupleData.revealDate': 1 })
      .populate('userId', 'firstName lastName')
      .populate('coupleData.giftFor', 'firstName lastName');

    return Promise.all(
      gifts.map(async gift => {
        if (!gift.coupleData?.giftFor) {
          throw new Error('Gift data is incomplete');
        }
        return this.mapToGiftResponseDto(gift, gift.userId, gift.coupleData.giftFor);
      })
    );
  }

  /**
   * Get gifts that will be revealed to the user (received gifts)
   */
  async getReceivedGifts(accountId: string, userId: string, onlyRevealed: boolean = true): Promise<GiftExpenseResponseDto[]> {
    const account = await this.accountModel.findById(accountId);
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    this.verifyUserAccess(account, userId);

    const query: any = {
      accountId: new Types.ObjectId(accountId),
      'coupleData.isGift': true,
      'coupleData.giftFor': userId,
      isDeleted: false
    };

    if (onlyRevealed) {
      query['coupleData.isRevealed'] = true;
    }

    const gifts = await this.expenseModel
      .find(query)
      .sort({ 'coupleData.revealedAt': -1, 'coupleData.revealDate': -1 })
      .populate('userId', 'firstName lastName')
      .populate('coupleData.giftFor', 'firstName lastName');

    return Promise.all(
      gifts.map(async gift => {
        if (!gift.coupleData?.giftFor) {
          throw new Error('Gift data is incomplete');
        }
        return this.mapToGiftResponseDto(gift, gift.userId, gift.coupleData.giftFor);
      })
    );
  }

  /**
   * Manually reveal a gift before its scheduled date
   */
  async revealGift(giftId: string, userId: string, revealData?: RevealGiftDto): Promise<{ success: boolean; gift: GiftExpenseResponseDto; message?: string }> {
    const gift = await this.expenseModel.findById(giftId);
    if (!gift || !gift.coupleData?.isGift) {
      throw new NotFoundException('Gift expense not found');
    }

    // Only the creator can manually reveal their gift
    if (gift.userId.toString() !== userId) {
      throw new ForbiddenException('Only the gift creator can reveal it manually');
    }

    if (!gift.coupleData) {
      throw new BadRequestException('Gift data is incomplete');
    }

    if (gift.coupleData.isRevealed) {
      throw new BadRequestException('Gift has already been revealed');
    }

    // Reveal the gift
    gift.coupleData.isRevealed = true;
    gift.coupleData.revealedAt = new Date();

    // Convert to shared expense if it was meant to be shared
    if (revealData?.revealNow) {
      gift.coupleData.expenseType = CoupleExpenseType.SHARED;
      gift.isSharedExpense = true;

      // Calculate split details based on couple's financial model
      const account = await this.accountModel.findById(gift.accountId).populate('coupleSettingsId');
      if (!account) {
        throw new NotFoundException('Account not found');
      }

      let coupleSettings: CoupleSettingsDocument | null = null;

      // Try to get populated coupleSettings from account
      if (account.populated('coupleSettingsId') && account.coupleSettingsId && this.isPopulatedCoupleSettings(account.coupleSettingsId)) {
        coupleSettings = account.coupleSettingsId;
      } else if (account.coupleSettingsId) {
        // If not populated, fetch it manually
        coupleSettings = await this.coupleSettingsModel.findById(account.coupleSettingsId);
      }

      const partners = this.getAccountPartners(account);

      if (coupleSettings) {
        gift.coupleData.splitDetails = this.calculateGiftSplitDetails(gift.amount, partners, coupleSettings);
      }
    }

    // Update metadata
    if (gift.metadata) {
      gift.metadata.additional = {
        ...gift.metadata.additional,
        revealedManually: true,
        revealMessage: revealData?.message
      };
    }

    await gift.save();

    // TODO: Send notification to recipient about revealed gift
    // await this.sendGiftRevealedNotification(gift);

    const createdBy = await this.userModel.findById(gift.userId);
    const giftFor = await this.userModel.findById(gift.coupleData.giftFor);

    return {
      success: true,
      gift: this.mapToGiftResponseDto(gift, createdBy, giftFor),
      message: revealData?.message
    };
  }

  /**
   * Delete a gift expense (only before it's revealed)
   */
  async deleteGift(giftId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const gift = await this.expenseModel.findById(giftId);
    if (!gift || !gift.coupleData?.isGift) {
      throw new NotFoundException('Gift expense not found');
    }

    // Only the creator can delete their gift
    if (gift.userId.toString() !== userId) {
      throw new ForbiddenException('Only the gift creator can delete it');
    }

    if (gift.coupleData.isRevealed) {
      throw new BadRequestException('Cannot delete a gift that has already been revealed');
    }

    // Soft delete the gift
    gift.isDeleted = true;
    gift.deletedAt = new Date();
    gift.deletedBy = userId; // UUID string

    await gift.save();

    return {
      success: true,
      message: 'Gift expense deleted successfully'
    };
  }

  /**
   * Update gift details (only before reveal)
   */
  async updateGift(giftId: string, userId: string, updateData: Partial<GiftExpenseDto>): Promise<GiftExpenseResponseDto> {
    const gift = await this.expenseModel.findById(giftId);
    if (!gift || !gift.coupleData?.isGift) {
      throw new NotFoundException('Gift expense not found');
    }

    // Only the creator can update their gift
    if (gift.userId.toString() !== userId) {
      throw new ForbiddenException('Only the gift creator can update it');
    }

    if (gift.coupleData.isRevealed) {
      throw new BadRequestException('Cannot update a gift that has already been revealed');
    }

    // Update allowed fields
    if (updateData.description) gift.description = updateData.description;
    if (updateData.amount) gift.amount = updateData.amount;
    if (updateData.categoryId) gift.categoryId = new Types.ObjectId(updateData.categoryId);
    if (updateData.notes !== undefined) gift.notes = updateData.notes;
    if (updateData.vendor !== undefined) gift.vendor = updateData.vendor;
    if (updateData.paymentMethod) {
      // Validate and convert string to PaymentMethod enum
      if (Object.values(PaymentMethod).includes(updateData.paymentMethod as PaymentMethod)) {
        gift.paymentMethod = updateData.paymentMethod as PaymentMethod;
      } else {
        throw new BadRequestException(`Invalid payment method: ${updateData.paymentMethod}`);
      }
    }
    if (updateData.attachedFiles) gift.fileIds = updateData.attachedFiles;

    // Update reveal date if provided and still in future
    if (updateData.revealDate) {
      if (updateData.revealDate <= new Date()) {
        throw new BadRequestException('Gift reveal date must be in the future');
      }
      gift.coupleData.revealDate = updateData.revealDate;
    }

    await gift.save();

    const createdBy = await this.userModel.findById(gift.userId);
    const giftFor = await this.userModel.findById(gift.coupleData.giftFor);

    return this.mapToGiftResponseDto(gift, createdBy, giftFor);
  }

  /**
   * Cron job to automatically reveal gifts when their reveal date arrives
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processScheduledGiftReveals(): Promise<void> {
    try {
      const now = new Date();

      // Find gifts that should be revealed now
      const giftsToReveal = await this.expenseModel.find({
        'coupleData.isGift': true,
        'coupleData.isRevealed': false,
        'coupleData.revealDate': { $lte: now },
        isDeleted: false
      });

      console.log(`Processing ${giftsToReveal.length} scheduled gift reveals...`);

      for (const gift of giftsToReveal) {
        try {
          if (!gift.coupleData) {
            console.error(`Gift ${gift.id} has no couple data, skipping`);
            continue;
          }

          // Reveal the gift
          gift.coupleData.isRevealed = true;
          gift.coupleData.revealedAt = new Date();

          // Convert to shared expense based on couple settings
          const account = await this.accountModel.findById(gift.accountId).populate('coupleSettingsId');
          if (account?.coupleSettingsId) {
            let coupleSettings: CoupleSettingsDocument | null = null;

            // Check if coupleSettingsId is populated (contains object with schema properties) or just an ObjectId
            if (account.coupleSettingsId && this.isPopulatedCoupleSettings(account.coupleSettingsId)) {
              // It's populated
              coupleSettings = account.coupleSettingsId;
            } else {
              // It's just an ObjectId, fetch it manually
              coupleSettings = await this.coupleSettingsModel.findById(account.coupleSettingsId);
            }

            if (!coupleSettings) {
              console.error(`Couple settings not found for account ${account.id}`);
              continue;
            }

            const partners = this.getAccountPartners(account);

            if (gift.coupleData) {
              gift.coupleData.expenseType = CoupleExpenseType.SHARED;
              gift.isSharedExpense = true;
              gift.coupleData.splitDetails = this.calculateGiftSplitDetails(gift.amount, partners, coupleSettings);
            }
          }

          await gift.save();

          // TODO: Send notification to recipient
          // await this.sendGiftRevealedNotification(gift);

          console.log(`Gift ${gift._id} revealed successfully`);
        } catch (error) {
          console.error(`Error revealing gift ${gift._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in processScheduledGiftReveals:', error);
    }
  }

  /**
   * Get upcoming gift reveals (admin/debug endpoint)
   */
  async getUpcomingReveals(
    accountId: string,
    userId: string
  ): Promise<{
    count: number;
    nextReveal?: Date;
    gifts: Array<{
      id: string;
      revealDate: Date;
      description: string;
      amount: number;
    }>;
  }> {
    const account = await this.accountModel.findById(accountId);
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    this.verifyUserAccess(account, userId);

    const upcomingGifts = await this.expenseModel
      .find({
        accountId: new Types.ObjectId(accountId),
        'coupleData.isGift': true,
        'coupleData.isRevealed': false,
        'coupleData.revealDate': { $gte: new Date() },
        isDeleted: false
      })
      .sort({ 'coupleData.revealDate': 1 });

    return {
      count: upcomingGifts.length,
      nextReveal: upcomingGifts.length > 0 && upcomingGifts[0].coupleData ? upcomingGifts[0].coupleData.revealDate : undefined,
      gifts: upcomingGifts.map(gift => ({
        id: gift.id,
        revealDate: gift.coupleData?.revealDate || new Date(),
        description: gift.description,
        amount: gift.amount
      }))
    };
  }

  // Private helper methods
  private verifyUserAccess(account: AccountDocument, userId: string): void {
    const hasAccess = account.owner.toString() === userId || account.members.some(member => member.userId.toString() === userId && member.isActive);

    if (!hasAccess) {
      throw new ForbiddenException('User does not have access to this couple account');
    }
  }

  private getAccountPartners(account: AccountDocument): string[] {
    const partners = [account.owner.toString()];

    account.members.forEach(member => {
      if (member.isActive && !partners.includes(member.userId.toString())) {
        partners.push(member.userId.toString());
      }
    });

    return partners;
  }

  private calculateGiftSplitDetails(amount: number, partners: string[], coupleSettings: CoupleSettingsDocument): any {
    // Default to equal split for gifts
    let partner1Amount = amount / 2;
    let partner2Amount = amount / 2;

    // Apply contribution settings if using proportional model
    if (coupleSettings.financialModel === 'proportional_income' && coupleSettings.contributionSettings) {
      const p1Percentage = coupleSettings.contributionSettings.partner1ContributionPercentage / 100;
      partner1Amount = amount * p1Percentage;
      partner2Amount = amount * (1 - p1Percentage);
    }

    return {
      partner1UserId: partners[0],
      partner2UserId: partners[1],
      partner1Amount,
      partner2Amount,
      splitMethod: 'equal',
      partner1Percentage: (partner1Amount / amount) * 100,
      partner2Percentage: (partner2Amount / amount) * 100
    };
  }

  private mapToGiftResponseDto(gift: ExpenseDocument, createdBy: any, giftFor: any): GiftExpenseResponseDto {
    return {
      id: gift.id,
      description: gift.description,
      amount: gift.amount,
      currency: gift.currency,
      categoryId: gift.categoryId.toString(),
      giftFor: {
        userId: giftFor._id.toString(),
        name: `${giftFor.firstName} ${giftFor.lastName}`
      },
      revealDate: gift.coupleData?.revealDate || new Date(),
      isRevealed: gift.coupleData?.isRevealed || false,
      revealedAt: gift.coupleData?.revealedAt,
      createdAt: gift.createdAt || new Date(),
      createdBy: {
        userId: createdBy._id.toString(),
        name: `${createdBy.firstName} ${createdBy.lastName}`
      }
    };
  }
}
