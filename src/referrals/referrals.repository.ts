import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ReferralReward, ReferralRewardDocument, RewardStatus, RewardType } from './schemas/referral-reward.schema';
import { ReferralSettings, ReferralSettingsDocument } from './schemas/referral-settings.schema';

@Injectable()
export class ReferralsRepository {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ReferralReward.name) private rewardModel: Model<ReferralRewardDocument>,
    @InjectModel(ReferralSettings.name) private settingsModel: Model<ReferralSettingsDocument>
  ) {}

  // User-related operations
  async findUserById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId).lean();
  }

  async findUserByReferralCode(code: string): Promise<UserDocument | null> {
    return this.userModel.findOne({
      $or: [{ referralCode: code }, { email: code }]
    });
  }

  async updateUserReferral(userId: string, referredByUserId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      referredByUserId: new Types.ObjectId(referredByUserId)
    });
  }

  async updateUserReferralCode(userId: string, referralCode: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { referralCode });
  }

  async markReferralCompleted(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      referralCompletedAt: new Date()
    });
  }

  async countUsersByReferrer(referrerId: string): Promise<number> {
    return this.userModel.countDocuments({
      referredByUserId: referrerId,
      referralCompletedAt: { $ne: null }
    });
  }

  async getUserReferralStats(userId: string): Promise<object[]> {
    return this.userModel.aggregate([
      { $match: { referredByUserId: userId } },
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          successfulReferrals: {
            $sum: { $cond: [{ $ne: ['$referralCompletedAt', null] }, 1, 0] }
          },
          pendingReferrals: {
            $sum: { $cond: [{ $eq: ['$referralCompletedAt', null] }, 1, 0] }
          }
        }
      }
    ]);
  }

  async getUsersReferredInDateRange(userId: string, startDate: Date, endDate: Date): Promise<UserDocument[]> {
    return this.userModel
      .find({
        referredByUserId: userId,
        createdAt: { $gte: startDate, $lte: endDate }
      })
      .lean();
  }

  async getReferralHistory(userId: string, skip: number, limit: number, status?: string): Promise<{ data: UserDocument[]; total: number }> {
    const matchQuery: Record<string, unknown> = { referredByUserId: userId };

    if (status === 'successful') {
      matchQuery.referralCompletedAt = { $ne: null };
    } else if (status === 'pending') {
      matchQuery.referralCompletedAt = null;
    }

    const pipeline: object[] = [
      { $match: matchQuery },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }, { $sort: { createdAt: -1 } }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    // @ts-ignore
    const [result] = await this.userModel.aggregate(pipeline);

    return {
      data: result.data,
      total: result.totalCount[0]?.count || 0
    };
  }

  // Reward-related operations
  async createReward(
    rewardData: { userId: string; referredUserId: string; rewardType: RewardType; amount: number; currency: string; status: RewardStatus }
  ): Promise<ReferralRewardDocument> {
    return this.rewardModel.create({
      ...rewardData,
      userId: new Types.ObjectId(rewardData.userId),
      referredUserId: new Types.ObjectId(rewardData.referredUserId)
    });
  }

  async findRewardsByUser(userId: string, skip: number, limit: number, status?: RewardStatus): Promise<{ data: ReferralRewardDocument[]; total: number }> {
    const matchQuery: Record<string, unknown> = { userId: userId };
    if (status) {
      matchQuery.status = status;
    }

    const pipeline: object[] = [
      { $match: matchQuery },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }, { $sort: { createdAt: -1 } }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    // @ts-ignore
    const [result] = await this.rewardModel.aggregate(pipeline);

    return {
      data: result.data,
      total: result.totalCount[0]?.count || 0
    };
  }

  async getRewardStats(userId: string, startDate?: Date, endDate?: Date): Promise<object[]> {
    const matchQuery: Record<string, unknown> = { userId: userId };

    if (startDate && endDate) {
      matchQuery.createdAt = { $gte: startDate, $lte: endDate };
    }

    return this.rewardModel
      .aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ])
      .exec();
  }

  async updateRewardStatus(rewardIds: string[], status: RewardStatus): Promise<void> {
    await this.rewardModel.updateMany(
      { _id: { $in: rewardIds.map(id => new Types.ObjectId(id)) } },
      {
        status,
        ...(status === RewardStatus.REDEEMED ? { redeemedAt: new Date() } : {})
      }
    );
  }

  async findAvailableRewards(userId: string): Promise<ReferralRewardDocument[]> {
    return this.rewardModel.find({
      userId: userId,
      status: RewardStatus.AVAILABLE
    });
  }

  async findPendingRewardsToActivate(): Promise<ReferralRewardDocument[]> {
    return this.rewardModel
      .aggregate([
        {
          $match: { status: RewardStatus.PENDING }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'referredUserId',
            foreignField: '_id',
            as: 'referredUser'
          }
        },
        {
          $match: { 'referredUser.referralCompletedAt': { $ne: null } }
        }
      ])
      .exec();
  }

  // Settings-related operations
  async findSettingsByUser(userId: string): Promise<ReferralSettingsDocument | null> {
    return this.settingsModel.findOne({ userId: userId });
  }

  async createOrUpdateSettings(userId: string, settings: Record<string, unknown>): Promise<ReferralSettingsDocument> {
    return this.settingsModel.findOneAndUpdate(
      { userId: userId },
      {
        ...settings,
        userId: userId,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
  }

  // Aggregation operations
  async aggregate(model: 'user' | 'reward' | 'settings', pipeline: object[]): Promise<object[]> {
    switch (model) {
      case 'user':
        // @ts-ignore
        return this.userModel.aggregate(pipeline).exec();
      case 'reward':
        // @ts-ignore
        return this.rewardModel.aggregate(pipeline).exec();
      case 'settings':
        // @ts-ignore
        return this.settingsModel.aggregate(pipeline).exec();
      default:
        throw new Error(`Unknown model: ${model}`);
    }
  }
}
