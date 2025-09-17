import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReferralsRepository } from '../referrals.repository';
import { ReferralCodeResponseDto } from '../dto/referral-code-response.dto';
import { ValidateReferralResponseDto } from '../dto/validate-referral-response.dto';
import { ReferralStatsQueryDto, StatsPeriod } from '../dto/referral-stats-query.dto';
import { ReferralStatsResponseDto } from '../dto/referral-stats-response.dto';
import { ReferralHistoryQueryDto, ReferralHistoryStatus } from '../dto/referral-history-query.dto';
import { ReferralHistoryResponseDto } from '../dto/referral-history-response.dto';
import { RewardsQueryDto, RewardStatusFilter } from '../dto/rewards-query.dto';
import { RewardsResponseDto } from '../dto/rewards-response.dto';
import { ReferralSettingsResponseDto } from '../dto/referral-settings.dto';
import { RewardStatus } from '../schemas/referral-reward.schema';

@Injectable()
export class ReferralQueryService {
  constructor(
    private readonly referralsRepository: ReferralsRepository,
    private readonly configService: ConfigService
  ) {}

  /**
   * Get user's referral code and statistics
   */
  async getMyReferralCode(userId: string): Promise<ReferralCodeResponseDto> {
    const user = await this.referralsRepository.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Ensure user has a referral code
    if (!user.referralCode) {
      // This should trigger code generation in command service
      throw new Error('Referral code not found');
    }

    const stats = await this.referralsRepository.getUserReferralStats(userId);
    const statsData = (stats[0] as { totalReferrals: number; successfulReferrals: number; pendingReferrals: number }) || {
      totalReferrals: 0,
      successfulReferrals: 0,
      pendingReferrals: 0
    };
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
   * Validate a referral code
   */
  async validateReferralCode(code: string): Promise<ValidateReferralResponseDto> {
    const referrer = await this.referralsRepository.findUserByReferralCode(code);

    if (!referrer) {
      return {
        valid: false,
        message: 'Invalid referral code'
      };
    }

    // Get referrer's total successful referrals
    const referralCount = await this.referralsRepository.countUsersByReferrer((referrer as any)._id.toString());

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
    const dateRange = this.getDateRange(period, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);

    // Get overview statistics
    const overview = await this.referralsRepository.getUserReferralStats(userId);
    const overviewData = (overview[0] as { totalReferrals: number; successfulReferrals: number; pendingReferrals: number }) || {
      totalReferrals: 0,
      successfulReferrals: 0,
      pendingReferrals: 0
    };

    // Get reward statistics
    const rewardStats = await this.referralsRepository.getRewardStats(userId, dateRange.start, dateRange.end);
    const rewardData = this.processRewardStats(rewardStats) as {
      totalEarned: number;
      pendingEarnings: number;
      availableToRedeem: number;
      totalRedeemed: number;
    };

    // Get time-series data for the specified period
    const timeSeries = await this.getTimeSeriesData(userId, dateRange.start, dateRange.end);

    // Calculate conversion rate and earnings
    const conversionRate = overviewData.totalReferrals > 0 ? (overviewData.successfulReferrals / overviewData.totalReferrals) * 100 : 0;

    return {
      overview: {
        totalReferrals: overviewData.totalReferrals,
        successfulReferrals: overviewData.successfulReferrals,
        pendingReferrals: overviewData.pendingReferrals,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        totalRewards: rewardData.totalEarned,
        availableRewards: rewardData.availableToRedeem,
        pendingRewards: rewardData.pendingEarnings,
        redeemedRewards: rewardData.totalRedeemed
      },
      chartData: timeSeries,
      period: period.toString(),
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString()
    };
  }

  /**
   * Get referral history for a user
   */
  async getReferralHistory(userId: string, query: ReferralHistoryQueryDto): Promise<ReferralHistoryResponseDto> {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const statusFilter = status === ReferralHistoryStatus.COMPLETED ? 'successful' : status === ReferralHistoryStatus.PENDING ? 'pending' : undefined;

    const result = await this.referralsRepository.getReferralHistory(userId, skip, limit, statusFilter);

    const formattedReferrals = result.data.map(user => ({
      id: (user as any)._id.toString(),
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      registeredAt: user.createdAt || new Date(),
      completedAt: user.referralCompletedAt,
      daysSinceRegistration: user.createdAt ? Math.floor((new Date().getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      activeDaysCount: 0,
      status: user.referralCompletedAt ? 'completed' : 'pending'
    }));

    const totalPages = Math.ceil(result.total / limit);

    return {
      data: formattedReferrals,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get user's rewards
   */
  async getRewards(userId: string, query: RewardsQueryDto): Promise<RewardsResponseDto> {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const statusFilter =
      status === RewardStatusFilter.AVAILABLE
        ? RewardStatus.AVAILABLE
        : status === RewardStatusFilter.PENDING
          ? RewardStatus.PENDING
          : status === RewardStatusFilter.REDEEMED
            ? RewardStatus.REDEEMED
            : undefined;

    const result = await this.referralsRepository.findRewardsByUser(userId, skip, limit, statusFilter);

    const formattedRewards = result.data.map(reward => ({
      id: (reward as any)._id.toString(),
      type: reward.rewardType,
      amount: reward.amount,
      currency: reward.currency,
      status: reward.status,
      createdAt: reward.createdAt || new Date(),
      redeemedAt: reward.redeemedAt,
      referredUserId: reward.referredUserId.toString(),
      referredUser: {
        email: '',
        name: ''
      }
    }));

    const totalPages = Math.ceil(result.total / limit);

    return {
      data: formattedRewards,
      summary: {
        totalAvailable: 0,
        totalRedeemed: 0,
        pendingAmount: 0,
        totalLifetime: 0,
        availableCount: 0,
        redeemedCount: 0,
        pendingCount: 0
      },
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get user's referral settings
   */
  async getReferralSettings(userId: string): Promise<ReferralSettingsResponseDto> {
    const settings = await this.referralsRepository.findSettingsByUser(userId);

    if (!settings) {
      // Return default settings
      return {
        id: userId,
        userId,
        emailNotifications: true,
        pushNotifications: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return {
      id: (settings as unknown as { _id: { toString: () => string } })._id?.toString() || '',
      userId: settings.userId.toString(),
      emailNotifications: settings.emailNotifications,
      pushNotifications: settings.pushNotifications,
      createdAt: settings.createdAt || new Date(),
      updatedAt: settings.updatedAt || new Date()
    };
  }

  private getDateRange(period: StatsPeriod, startDate?: Date, endDate?: Date): { start: Date; end: Date } {
    const now = new Date();
    const end = endDate || now;

    if (startDate && endDate) {
      return { start: startDate, end: endDate };
    }

    let start: Date;
    switch (period) {
      case StatsPeriod.LAST_7_DAYS:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case StatsPeriod.LAST_30_DAYS:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case StatsPeriod.LAST_90_DAYS:
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case StatsPeriod.LAST_YEAR:
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  private processRewardStats(rewardStats: object[]): object {
    let totalEarned = 0;
    let pendingEarnings = 0;
    let availableToRedeem = 0;
    let totalRedeemed = 0;

    rewardStats.forEach(stat => {
      const statRecord = stat as Record<string, unknown>;
      const amount = (statRecord.totalAmount as number) || 0;
      totalEarned += amount;

      switch (statRecord._id) {
        case RewardStatus.PENDING:
          pendingEarnings += amount;
          break;
        case RewardStatus.AVAILABLE:
          availableToRedeem += amount;
          break;
        case RewardStatus.REDEEMED:
          totalRedeemed += amount;
          break;
      }
    });

    return {
      totalEarned,
      pendingEarnings,
      availableToRedeem,
      totalRedeemed
    };
  }

  private async getTimeSeriesData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; referrals: number; conversions: number; conversionRate: number }>> {
    const users = await this.referralsRepository.getUsersReferredInDateRange(userId, startDate, endDate);

    // Group by date
    const dateGroups: { [key: string]: number } = {};
    users.forEach(user => {
      if (user.createdAt) {
        const date = user.createdAt.toISOString().split('T')[0];
        dateGroups[date] = (dateGroups[date] || 0) + 1;
      }
    });

    // Convert to array format
    return Object.entries(dateGroups)
      .map(([date, count]) => ({
        date,
        referrals: count,
        conversions: 0,
        conversionRate: 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
