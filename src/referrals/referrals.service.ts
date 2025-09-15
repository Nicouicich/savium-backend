import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ReferralReward, ReferralRewardDocument, RewardStatus, RewardType } from './schemas/referral-reward.schema';
import { ReferralSettings, ReferralSettingsDocument } from './schemas/referral-settings.schema';
import {
  InvalidReferralCodeException,
  SelfReferralException,
  AlreadyReferredException,
  RewardNotAvailableException,
  DuplicateReferralCodeException
} from '@common/exceptions';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import { ReferralCodeResponseDto } from './dto/referral-code-response.dto';
import { ValidateReferralResponseDto } from './dto/validate-referral-response.dto';
import { ReferralStatsQueryDto, StatsPeriod } from './dto/referral-stats-query.dto';
import { ReferralStatsResponseDto } from './dto/referral-stats-response.dto';
import { ReferralHistoryQueryDto, ReferralHistoryStatus } from './dto/referral-history-query.dto';
import { ReferralHistoryResponseDto } from './dto/referral-history-response.dto';
import { RewardsQueryDto, RewardStatusFilter } from './dto/rewards-query.dto';
import { RewardsResponseDto } from './dto/rewards-response.dto';
import { RedeemRewardsDto, RedeemRewardsResponseDto } from './dto/redeem-rewards.dto';
import { UpdateReferralSettingsDto, ReferralSettingsResponseDto } from './dto/referral-settings.dto';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ReferralReward.name) private rewardModel: Model<ReferralRewardDocument>,
    @InjectModel(ReferralSettings.name) private settingsModel: Model<ReferralSettingsDocument>,
    private configService: ConfigService
  ) {}

  /**
   * Get user's referral code and statistics
   */
  async getMyReferralCode(userId: string): Promise<ReferralCodeResponseDto> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new Error('User not found');
    }

    // Ensure user has a referral code
    if (!user.referralCode) {
      await this.generateReferralCode(userId);
      user.referralCode = user.email; // Fallback for immediate response
    }

    const stats = await this.userModel.aggregate([
      { $match: { referredByUserId: new Types.ObjectId(userId) } },
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

    const statsData = stats[0] || { totalReferrals: 0, successfulReferrals: 0, pendingReferrals: 0 };
    const conversionRate = statsData.totalReferrals > 0 ? (statsData.successfulReferrals / statsData.totalReferrals) * 100 : 0;

    const frontendUrl = this.configService.get('app.frontendUrl') || 'https://app.savium.com';

    return {
      code: user.referralCode,
      shareUrl: `${frontendUrl}/signup?ref=${encodeURIComponent(user.referralCode)}`,
      totalReferrals: statsData.totalReferrals,
      successfulReferrals: statsData.successfulReferrals,
      pendingReferrals: statsData.pendingReferrals,
      conversionRate: parseFloat(conversionRate.toFixed(2))
    };
  }

  /**
   * Apply a referral code to a user
   */
  async applyReferralCode(userId: string, dto: ApplyReferralDto): Promise<{ success: boolean; message: string; referrerInfo?: any }> {
    // Find the referrer by username or email
    const referrer = (await this.userModel.findOne({
      $or: [{ referralCode: dto.referralCode }, { email: dto.referralCode }]
    })) as UserDocument;

    if (!referrer) {
      throw new InvalidReferralCodeException(dto.referralCode);
    }

    // Validate that user is not referring themselves
    if ((referrer as any)._id.toString() === userId) {
      throw new SelfReferralException();
    }

    // Check if user has already been referred
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.referredByUserId) {
      throw new AlreadyReferredException();
    }

    // Apply the referral
    await this.userModel.findByIdAndUpdate(userId, {
      referredByUserId: referrer._id
    });

    // Create pending reward for the referrer
    const rewardAmount = this.configService.get('app.referral.rewardAmount') || 10;
    const rewardCurrency = this.configService.get('app.referral.rewardCurrency') || 'USD';

    await this.rewardModel.create({
      userId: (referrer as any)._id,
      referredUserId: new Types.ObjectId(userId),
      rewardType: RewardType.CASH,
      amount: rewardAmount,
      currency: rewardCurrency,
      status: RewardStatus.PENDING
    });

    this.logger.log('Referral applied', { userId, referrerId: (referrer as any)._id.toString() });

    return {
      success: true,
      message: 'Referral code applied successfully',
      referrerInfo: {
        name: `${referrer.firstName} ${referrer.lastName}`,
        email: referrer.email
      }
    };
  }

  /**
   * Validate a referral code
   */
  async validateReferralCode(code: string): Promise<ValidateReferralResponseDto> {
    const referrer = await this.userModel
      .findOne({
        $or: [{ referralCode: code }, { email: code }]
      })
      .lean();

    if (!referrer) {
      return {
        valid: false,
        message: 'Invalid referral code'
      };
    }

    // Get referrer's total successful referrals
    const referralCount = await this.userModel.countDocuments({
      referredByUserId: referrer._id,
      referralCompletedAt: { $ne: null }
    });

    return {
      valid: true,
      message: 'Valid referral code',
      referrerInfo: {
        name: `${referrer.firstName} ${referrer.lastName}`,
        email: referrer.email,
        totalReferrals: referralCount
      }
    };
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string, query: ReferralStatsQueryDto): Promise<ReferralStatsResponseDto> {
    const { period = StatsPeriod.LAST_30_DAYS, startDate, endDate } = query;
    const dateRange = this.getDateRange(period, startDate, endDate);

    // Get overview statistics
    const overview = await this.userModel.aggregate([
      { $match: { referredByUserId: new Types.ObjectId(userId) } },
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

    // Get reward statistics
    const rewards = await this.rewardModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalRewards: { $sum: '$amount' },
          availableRewards: {
            $sum: { $cond: [{ $eq: ['$status', RewardStatus.AVAILABLE] }, '$amount', 0] }
          },
          pendingRewards: {
            $sum: { $cond: [{ $eq: ['$status', RewardStatus.PENDING] }, '$amount', 0] }
          },
          redeemedRewards: {
            $sum: { $cond: [{ $eq: ['$status', RewardStatus.REDEEMED] }, '$amount', 0] }
          }
        }
      }
    ]);

    // Get chart data
    const chartData = await this.userModel.aggregate([
      {
        $match: {
          referredByUserId: new Types.ObjectId(userId),
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          referrals: { $sum: 1 },
          conversions: {
            $sum: { $cond: [{ $ne: ['$referralCompletedAt', null] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const overviewData = overview[0] || { totalReferrals: 0, successfulReferrals: 0, pendingReferrals: 0 };
    const rewardData = rewards[0] || { totalRewards: 0, availableRewards: 0, pendingRewards: 0, redeemedRewards: 0 };

    const conversionRate = overviewData.totalReferrals > 0 ? (overviewData.successfulReferrals / overviewData.totalReferrals) * 100 : 0;

    return {
      overview: {
        ...overviewData,
        ...rewardData,
        conversionRate: parseFloat(conversionRate.toFixed(2))
      },
      chartData: chartData.map(item => ({
        date: item._id,
        referrals: item.referrals,
        conversions: item.conversions,
        conversionRate: item.referrals > 0 ? parseFloat(((item.conversions / item.referrals) * 100).toFixed(2)) : 0
      })),
      period: period || 'custom',
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString()
    };
  }

  /**
   * Get referral history with pagination and filtering
   */
  async getReferralHistory(userId: string, query: ReferralHistoryQueryDto): Promise<ReferralHistoryResponseDto> {
    const { page = 1, limit = 10, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const matchConditions: any = { referredByUserId: new Types.ObjectId(userId) };

    // Apply status filter
    if (status === ReferralHistoryStatus.COMPLETED) {
      matchConditions.referralCompletedAt = { $ne: null };
    } else if (status === ReferralHistoryStatus.PENDING) {
      matchConditions.referralCompletedAt = null;
    }

    // Apply search filter
    if (search) {
      matchConditions.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'referralrewards',
          localField: '_id',
          foreignField: 'referredUserId',
          as: 'reward'
        }
      },
      {
        $addFields: {
          daysSinceRegistration: {
            $divide: [{ $subtract: [new Date(), '$createdAt'] }, 1000 * 60 * 60 * 24]
          }
        }
      },
      {
        $project: {
          id: '$_id',
          email: 1,
          name: { $concat: ['$firstName', ' ', '$lastName'] },
          registeredAt: '$createdAt',
          completedAt: '$referralCompletedAt',
          status: {
            $cond: [{ $ne: ['$referralCompletedAt', null] }, 'completed', 'pending']
          },
          daysSinceRegistration: { $floor: '$daysSinceRegistration' },
          activeDaysCount: 1,
          reward: { $arrayElemAt: ['$reward', 0] }
        }
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit }
    ];

    const [data, totalCount] = await Promise.all([this.userModel.aggregate(pipeline), this.userModel.countDocuments(matchConditions)]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: data.map(item => ({
        ...item,
        reward: item.reward
          ? {
              id: item.reward._id,
              type: item.reward.rewardType,
              amount: item.reward.amount,
              currency: item.reward.currency,
              status: item.reward.status,
              createdAt: item.reward.createdAt,
              redeemedAt: item.reward.redeemedAt
            }
          : undefined
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get user's rewards with pagination and filtering
   */
  async getRewards(userId: string, query: RewardsQueryDto): Promise<RewardsResponseDto> {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const matchConditions: any = { userId: new Types.ObjectId(userId) };
    if (status && status !== RewardStatusFilter.ALL) {
      matchConditions.status = status;
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'users',
          localField: 'referredUserId',
          foreignField: '_id',
          as: 'referredUser'
        }
      },
      {
        $project: {
          id: '$_id',
          referredUser: {
            email: { $arrayElemAt: ['$referredUser.email', 0] },
            name: {
              $concat: [{ $arrayElemAt: ['$referredUser.firstName', 0] }, ' ', { $arrayElemAt: ['$referredUser.lastName', 0] }]
            }
          },
          amount: 1,
          currency: 1,
          type: '$rewardType',
          status: 1,
          createdAt: 1,
          redeemedAt: 1,
          expiresAt: 1
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const [data, summary, totalCount] = await Promise.all([
      this.rewardModel.aggregate(pipeline),
      this.getRewardSummary(userId),
      this.rewardModel.countDocuments(matchConditions)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      summary,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Redeem rewards
   */
  async redeemRewards(userId: string, dto: RedeemRewardsDto): Promise<RedeemRewardsResponseDto> {
    const { rewardIds, redemptionMethod, redemptionDetails } = dto;

    // Validate that all rewards belong to the user and are available
    const rewards = await this.rewardModel.find({
      _id: { $in: rewardIds.map(id => new Types.ObjectId(id)) },
      userId: new Types.ObjectId(userId),
      status: RewardStatus.AVAILABLE
    });

    if (rewards.length !== rewardIds.length) {
      throw new RewardNotAvailableException(rewardIds.join(', '), 'Some rewards are not available for redemption');
    }

    const totalAmount = rewards.reduce((sum, reward) => sum + reward.amount, 0);
    const currency = rewards[0].currency;

    // Update rewards to redeemed status
    await this.rewardModel.updateMany(
      { _id: { $in: rewardIds.map(id => new Types.ObjectId(id)) } },
      {
        status: RewardStatus.REDEEMED,
        redemptionMethod,
        redemptionDetails,
        redeemedAt: new Date()
      }
    );

    // Here you would integrate with actual payment processing
    // For now, we'll simulate the process
    const transactionId = `TXN_${Date.now()}_${userId}`;

    this.logger.log(`Rewards redeemed: User ${userId}, Amount: ${totalAmount} ${currency}, Method: ${redemptionMethod}`);

    const processingTimeMap = {
      bank_transfer: '3-5 business days',
      paypal: '1-2 business days',
      gift_card: 'Immediate',
      account_credit: 'Immediate',
      crypto: '1-3 business days'
    };

    return {
      success: true,
      totalAmount,
      currency,
      rewardsCount: rewards.length,
      redemptionMethod,
      message: `Successfully redeemed ${totalAmount} ${currency} via ${redemptionMethod}`,
      transactionId,
      processingTime: processingTimeMap[redemptionMethod] || '1-5 business days'
    };
  }

  /**
   * Get or create user's referral settings
   */
  async getReferralSettings(userId: string): Promise<ReferralSettingsResponseDto> {
    let settings = await this.settingsModel.findOne({ userId: new Types.ObjectId(userId) });

    if (!settings) {
      settings = await this.settingsModel.create({ userId: new Types.ObjectId(userId) });
    }

    return this.mapSettingsToResponse(settings);
  }

  /**
   * Update user's referral settings
   */
  async updateReferralSettings(userId: string, dto: UpdateReferralSettingsDto): Promise<ReferralSettingsResponseDto> {
    // If custom referral code is being set, validate uniqueness
    if (dto.customReferralCode && dto.useCustomCode) {
      const existing = await this.settingsModel.findOne({
        customReferralCode: dto.customReferralCode,
        userId: { $ne: new Types.ObjectId(userId) }
      });

      if (existing) {
        throw new DuplicateReferralCodeException(dto.customReferralCode);
      }

      // Also check if it conflicts with user emails or default codes
      const userExists = await this.userModel.findOne({
        $or: [{ email: dto.customReferralCode }, { referralCode: dto.customReferralCode }],
        _id: { $ne: new Types.ObjectId(userId) }
      });

      if (userExists) {
        throw new DuplicateReferralCodeException(dto.customReferralCode);
      }
    }

    const settings = await this.settingsModel.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $set: dto }, { new: true, upsert: true });

    return this.mapSettingsToResponse(settings);
  }

  /**
   * Mark user as active for referral tracking
   */
  async markUserActive(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      lastActiveAt: new Date()
    });
  }

  /**
   * Complete referral for users who have reached the required active days
   */
  async completeReferralsForActiveUsers(): Promise<void> {
    const requiredActiveDays = this.configService.get('app.referral.completionDays') || 7;

    // Find users who have reached the required active days but haven't completed referral
    const eligibleUsers = await this.userModel.find({
      referredByUserId: { $exists: true, $ne: null },
      referralCompletedAt: null,
      activeDaysCount: { $gte: requiredActiveDays }
    });

    for (const user of eligibleUsers) {
      try {
        await this.completeReferral((user._id as any).toString());
      } catch (error) {
        this.logger.error(`Failed to complete referral for user ${user._id as any}:`, error);
      }
    }
  }

  /**
   * Complete a specific user's referral
   */
  async completeReferral(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);

    if (!user?.referredByUserId || user.referralCompletedAt) {
      return;
    }

    // Mark referral as completed
    await this.userModel.findByIdAndUpdate(userId, {
      referralCompletedAt: new Date()
    });

    // Activate the referrer's reward
    const updatedReward = await this.rewardModel.findOneAndUpdate(
      {
        userId: user.referredByUserId,
        referredUserId: user._id,
        status: RewardStatus.PENDING
      },
      {
        status: RewardStatus.AVAILABLE
      },
      { new: true }
    );

    if (updatedReward) {
      this.logger.log(`Referral completed for user ${userId}, reward activated for referrer ${user.referredByUserId?.toString()}`);
    } else {
      this.logger.warn(`No pending reward found for completed referral: user ${userId}`);
    }
  }

  /**
   * Generate referral code for user
   */
  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const referralCode = user.email; // Default to email

    // Update user with referral code
    await this.userModel.findByIdAndUpdate(userId, { referralCode });

    return referralCode;
  }

  /**
   * Update active days count for users who were active yesterday
   */
  async updateActiveDaysCount(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find users who were active yesterday
    const activeUsers = await this.userModel.find({
      lastActiveAt: {
        $gte: yesterday,
        $lt: today
      }
    });

    for (const user of activeUsers) {
      await this.userModel.findByIdAndUpdate(user._id, {
        $inc: { activeDaysCount: 1 }
      });
    }

    this.logger.log(`Updated active days count for ${activeUsers.length} users`);
  }

  // Private helper methods

  private getDateRange(period: StatsPeriod, startDate?: string, endDate?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    let start: Date;

    if (startDate) {
      start = new Date(startDate);
    } else {
      switch (period) {
        case StatsPeriod.LAST_7_DAYS:
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case StatsPeriod.LAST_30_DAYS:
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case StatsPeriod.LAST_90_DAYS:
          start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case StatsPeriod.LAST_YEAR:
          start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date('2020-01-01'); // All time default
      }
    }

    return { start, end };
  }

  private async getRewardSummary(userId: string) {
    const summary = await this.rewardModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalAvailable: {
            $sum: { $cond: [{ $eq: ['$status', RewardStatus.AVAILABLE] }, '$amount', 0] }
          },
          totalRedeemed: {
            $sum: { $cond: [{ $eq: ['$status', RewardStatus.REDEEMED] }, '$amount', 0] }
          },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ['$status', RewardStatus.PENDING] }, '$amount', 0] }
          },
          totalLifetime: { $sum: '$amount' },
          availableCount: {
            $sum: { $cond: [{ $eq: ['$status', RewardStatus.AVAILABLE] }, 1, 0] }
          },
          redeemedCount: {
            $sum: { $cond: [{ $eq: ['$status', RewardStatus.REDEEMED] }, 1, 0] }
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', RewardStatus.PENDING] }, 1, 0] }
          }
        }
      }
    ]);

    return (
      summary[0] || {
        totalAvailable: 0,
        totalRedeemed: 0,
        pendingAmount: 0,
        totalLifetime: 0,
        availableCount: 0,
        redeemedCount: 0,
        pendingCount: 0
      }
    );
  }

  private mapSettingsToResponse(settings: ReferralSettingsDocument): ReferralSettingsResponseDto {
    return {
      id: (settings._id as any).toString(),
      userId: settings.userId.toString(),
      notificationsEnabled: settings.notificationsEnabled,
      emailNotifications: settings.emailNotifications,
      pushNotifications: settings.pushNotifications,
      smsNotifications: settings.smsNotifications,
      privacyMode: settings.privacyMode as any,
      allowPublicSharing: settings.allowPublicSharing,
      showInLeaderboards: settings.showInLeaderboards,
      autoGenerateShareLinks: settings.autoGenerateShareLinks,
      customReferralCode: settings.customReferralCode,
      useCustomCode: settings.useCustomCode,
      rewardPreferences: settings.rewardPreferences,
      allowMarketingEmails: settings.allowMarketingEmails,
      allowThirdPartyPromotions: settings.allowThirdPartyPromotions,
      allowAnalyticsTracking: settings.allowAnalyticsTracking,
      shareSuccessStories: settings.shareSuccessStories,
      createdAt: settings.createdAt || new Date(),
      updatedAt: settings.updatedAt || new Date()
    };
  }
}
