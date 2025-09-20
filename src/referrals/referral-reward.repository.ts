import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, QueryOptions, Types, UpdateQuery } from 'mongoose';
import { ReferralReward, ReferralRewardDocument, RewardStatus, RewardType } from './schemas/referral-reward.schema';

@Injectable()
export class ReferralRewardRepository {
  private readonly logger = new Logger(ReferralRewardRepository.name);

  constructor(@InjectModel(ReferralReward.name) private readonly model: Model<ReferralRewardDocument>) {}

  // ============= CREATE OPERATIONS =============
  async create(data: Partial<ReferralReward>): Promise<ReferralRewardDocument> {
    const entity = new this.model(data);
    return await entity.save();
  }

  async createMany(data: Partial<ReferralReward>[]): Promise<ReferralRewardDocument[]> {
    const result = await this.model.insertMany(data);
    return result as ReferralRewardDocument[];
  }

  // ============= READ OPERATIONS =============
  async findById(id: string | Types.ObjectId): Promise<ReferralRewardDocument | null> {
    return await this.model.findById(id).exec();
  }

  async findOne(filter: FilterQuery<ReferralRewardDocument>): Promise<ReferralRewardDocument | null> {
    return await this.model.findOne(filter).exec();
  }

  async find(filter: FilterQuery<ReferralRewardDocument> = {}, options?: QueryOptions): Promise<ReferralRewardDocument[]> {
    const query = this.model.find(filter);

    if (options?.sort) query.sort(options.sort);
    if (options?.limit) query.limit(options.limit);
    if (options?.skip) query.skip(options.skip);
    if (options?.populate) {
      if (Array.isArray(options.populate)) {
        query.populate(options.populate as any);
      } else {
        query.populate(options.populate as any);
      }
    }

    return await query.exec();
  }

  async findWithPagination(
    filter: FilterQuery<ReferralRewardDocument> = {},
    page: number = 1,
    limit: number = 10,
    sort: any = { createdAt: -1 }
  ): Promise<{
    data: ReferralRewardDocument[];
    total: number;
    page: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([this.find(filter, { skip, limit, sort }), this.count(filter)]);

    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  // ============= UPDATE OPERATIONS =============
  async updateById(id: string | Types.ObjectId, update: UpdateQuery<ReferralRewardDocument>, options?: QueryOptions): Promise<ReferralRewardDocument | null> {
    return await this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true, ...options }).exec();
  }

  async updateOne(
    filter: FilterQuery<ReferralRewardDocument>,
    update: UpdateQuery<ReferralRewardDocument>,
    options?: QueryOptions
  ): Promise<ReferralRewardDocument | null> {
    return await this.model.findOneAndUpdate(filter, update, { new: true, runValidators: true, ...options }).exec();
  }

  async updateMany(filter: FilterQuery<ReferralRewardDocument>, update: UpdateQuery<ReferralRewardDocument>): Promise<{ modifiedCount: number }> {
    const result = await this.model.updateMany(filter, update).exec();
    return { modifiedCount: result.modifiedCount || 0 };
  }

  // ============= DELETE OPERATIONS =============
  async deleteById(id: string | Types.ObjectId): Promise<ReferralRewardDocument | null> {
    return await this.model.findByIdAndDelete(id).exec();
  }

  async deleteOne(filter: FilterQuery<ReferralRewardDocument>): Promise<ReferralRewardDocument | null> {
    return await this.model.findOneAndDelete(filter).exec();
  }

  async deleteMany(filter: FilterQuery<ReferralRewardDocument>): Promise<{ deletedCount: number }> {
    const result = await this.model.deleteMany(filter).exec();
    return { deletedCount: result.deletedCount || 0 };
  }

  // ============= AGGREGATION OPERATIONS =============
  async aggregate(pipeline: any[]): Promise<any[]> {
    return await this.model.aggregate(pipeline).exec();
  }

  // ============= UTILITY OPERATIONS =============
  async count(filter: FilterQuery<ReferralRewardDocument> = {}): Promise<number> {
    return await this.model.countDocuments(filter).exec();
  }

  async exists(filter: FilterQuery<ReferralRewardDocument>): Promise<boolean> {
    const count = await this.count(filter);
    return count > 0;
  }

  // ============= TRANSACTION SUPPORT =============
  async withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.model.db.startSession();
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ============= BULK OPERATIONS =============
  async bulkWrite(operations: any[]): Promise<any> {
    return await this.model.bulkWrite(operations);
  }

  // ============= REFERRAL REWARD SPECIFIC OPERATIONS =============

  /**
   * Find rewards by user ID with optional status filter
   */
  async findByUserId(userId: string | Types.ObjectId, status?: RewardStatus, options?: QueryOptions): Promise<ReferralRewardDocument[]> {
    const filter: FilterQuery<ReferralRewardDocument> = {
      userId: typeof userId === 'string' ? new Types.ObjectId(userId) : userId
    };

    if (status) {
      filter.status = status;
    }

    return this.find(filter, options);
  }

  /**
   * Find available rewards for a user
   */
  async findAvailableByUserId(userId: string | Types.ObjectId): Promise<ReferralRewardDocument[]> {
    return this.findByUserId(userId, RewardStatus.AVAILABLE, { sort: { createdAt: -1 } });
  }

  /**
   * Find pending rewards that can be activated
   */
  async findPendingForActivation(): Promise<ReferralRewardDocument[]> {
    return this.find({ status: RewardStatus.PENDING }, { sort: { createdAt: 1 } });
  }

  /**
   * Find expired rewards (created more than specified days ago)
   */
  async findExpiredRewards(daysOld: number = 365): Promise<ReferralRewardDocument[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.find({
      status: RewardStatus.AVAILABLE,
      createdAt: { $lt: cutoffDate }
    });
  }

  /**
   * Update multiple rewards to a new status
   */
  async updateStatusByIds(
    rewardIds: (string | Types.ObjectId)[],
    status: RewardStatus,
    additionalFields?: Record<string, any>
  ): Promise<{ modifiedCount: number }> {
    const objectIds = rewardIds.map(id => (typeof id === 'string' ? new Types.ObjectId(id) : id));

    const updateData: UpdateQuery<ReferralRewardDocument> = {
      status,
      updatedAt: new Date(),
      ...additionalFields
    };

    // Add specific timestamp fields based on status
    if (status === RewardStatus.REDEEMED) {
      updateData.redeemedAt = new Date();
    } else if (status === RewardStatus.EXPIRED) {
      updateData.expiredAt = new Date();
    }

    return this.updateMany({ _id: { $in: objectIds } }, updateData);
  }

  /**
   * Get reward statistics for a user
   */
  async getRewardStatsByUserId(
    userId: string | Types.ObjectId,
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<{
      _id: RewardStatus;
      count: number;
      totalAmount: number;
    }>
  > {
    const matchQuery: FilterQuery<ReferralRewardDocument> = {
      userId: typeof userId === 'string' ? new Types.ObjectId(userId) : userId
    };

    if (startDate && endDate) {
      matchQuery.createdAt = { $gte: startDate, $lte: endDate };
    }

    return this.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }

  /**
   * Get total reward amount by status for a user
   */
  async getTotalRewardAmountByUserId(userId: string | Types.ObjectId, status?: RewardStatus, currency?: string): Promise<number> {
    const matchQuery: FilterQuery<ReferralRewardDocument> = {
      userId: typeof userId === 'string' ? new Types.ObjectId(userId) : userId
    };

    if (status) {
      matchQuery.status = status;
    }

    if (currency) {
      matchQuery.currency = currency;
    }

    const result = await this.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    return result[0]?.totalAmount || 0;
  }

  /**
   * Create a referral reward
   */
  async createReferralReward(rewardData: {
    userId: string | Types.ObjectId;
    referredUserId: string | Types.ObjectId;
    rewardType: RewardType;
    amount: number;
    currency: string;
    status?: RewardStatus;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<ReferralRewardDocument> {
    const data: Partial<ReferralReward> = {
      ...rewardData,
      userId: typeof rewardData.userId === 'string' ? new Types.ObjectId(rewardData.userId) : rewardData.userId,
      referredUserId: typeof rewardData.referredUserId === 'string' ? new Types.ObjectId(rewardData.referredUserId) : rewardData.referredUserId,
      status: rewardData.status || RewardStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.create(data);
  }

  /**
   * Mark rewards as expired
   */
  async markRewardsAsExpired(rewardIds?: (string | Types.ObjectId)[]): Promise<{ modifiedCount: number }> {
    let filter: FilterQuery<ReferralRewardDocument>;

    if (rewardIds && rewardIds.length > 0) {
      const objectIds = rewardIds.map(id => (typeof id === 'string' ? new Types.ObjectId(id) : id));
      filter = { _id: { $in: objectIds } };
    } else {
      // Default to marking old available rewards as expired
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      filter = {
        status: RewardStatus.AVAILABLE,
        createdAt: { $lt: oneYearAgo }
      };
    }

    return this.updateMany(filter, {
      status: RewardStatus.EXPIRED,
      expiredAt: new Date(),
      updatedAt: new Date()
    });
  }
}
