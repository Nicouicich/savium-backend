import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReferralsRepository } from '../referrals.repository';
import { ApplyReferralDto } from '../dto/apply-referral.dto';
import { RedeemRewardsDto, RedeemRewardsResponseDto } from '../dto/redeem-rewards.dto';
import { UpdateReferralSettingsDto, ReferralSettingsResponseDto } from '../dto/referral-settings.dto';
import { RewardStatus, RewardType } from '../schemas/referral-reward.schema';
import {
  InvalidReferralCodeException,
  SelfReferralException,
  AlreadyReferredException,
  RewardNotAvailableException,
  DuplicateReferralCodeException
} from '@common/exceptions/business.exceptions';

@Injectable()
export class ReferralCommandService {
  private readonly logger = new Logger(ReferralCommandService.name);

  constructor(
    private readonly referralsRepository: ReferralsRepository,
    private readonly configService: ConfigService
  ) {}

  /**
   * Generate referral code for a user
   */
  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.referralsRepository.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // If user already has a referral code, return it
    if (user.referralCode) {
      return user.referralCode;
    }

    // Generate new referral code based on email
    let referralCode = user.email;
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure uniqueness
    while (attempts < maxAttempts) {
      const existingUser = await this.referralsRepository.findUserByReferralCode(referralCode);
      if (!existingUser || (existingUser as any)._id.toString() === userId) {
        break;
      }

      attempts++;
      referralCode = `${user.email}-${attempts}`;
    }

    if (attempts >= maxAttempts) {
      throw new DuplicateReferralCodeException(referralCode);
    }

    // Update user with referral code
    await this.referralsRepository.updateUserReferralCode(userId, referralCode);

    this.logger.log('Referral code generated', { userId, referralCode });
    return referralCode;
  }

  /**
   * Apply a referral code to a user
   */
  async applyReferralCode(userId: string, dto: ApplyReferralDto): Promise<{ success: boolean; message: string; referrerInfo?: object }> {
    // Find the referrer by username or email
    const referrer = await this.referralsRepository.findUserByReferralCode(dto.referralCode);

    if (!referrer) {
      throw new InvalidReferralCodeException(dto.referralCode);
    }

    // Validate that user is not referring themselves
    if ((referrer as any)._id.toString() === userId) {
      throw new SelfReferralException();
    }

    // Check if user has already been referred
    const user = await this.referralsRepository.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.referredByUserId) {
      throw new AlreadyReferredException();
    }

    // Apply the referral
    await this.referralsRepository.updateUserReferral(userId, (referrer as any)._id.toString());

    // Create pending reward for the referrer
    const rewardAmount = this.configService.get('app.referral.rewardAmount') || 10;
    const rewardCurrency = this.configService.get('app.referral.rewardCurrency') || 'USD';

    await this.referralsRepository.createReward({
      userId: (referrer as any)._id.toString(),
      referredUserId: userId,
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
   * Mark a referral as completed (trigger reward activation)
   */
  async completeReferral(userId: string): Promise<void> {
    await this.referralsRepository.markReferralCompleted(userId);
    this.logger.log('Referral completed', { userId });
  }

  /**
   * Redeem available rewards
   */
  async redeemRewards(userId: string, dto: RedeemRewardsDto): Promise<RedeemRewardsResponseDto> {
    // Validate that all specified rewards belong to the user and are available
    const availableRewards = await this.referralsRepository.findAvailableRewards(userId);
    const availableRewardIds = availableRewards.map(r => (r as any)._id.toString());

    const invalidRewards = dto.rewardIds.filter(id => !availableRewardIds.includes(id));
    if (invalidRewards.length > 0) {
      throw new RewardNotAvailableException(invalidRewards[0], 'not_available');
    }

    // Calculate total redemption amount
    const rewardsToRedeem = availableRewards.filter(r => dto.rewardIds.includes((r as any)._id.toString()));
    const totalAmount = rewardsToRedeem.reduce((sum, reward) => sum + reward.amount, 0);

    // Update reward statuses
    await this.referralsRepository.updateRewardStatus(dto.rewardIds, RewardStatus.REDEEMED);

    this.logger.log('Rewards redeemed', {
      userId,
      rewardIds: dto.rewardIds,
      totalAmount,
      redemptionMethod: dto.redemptionMethod
    });

    return {
      success: true,
      message: 'Rewards redeemed successfully',
      totalAmount,
      currency: rewardsToRedeem[0]?.currency || 'USD',
      rewardsCount: dto.rewardIds.length,
      redemptionMethod: dto.redemptionMethod,
      transactionId: `TXN_${Date.now()}_${userId}`,
      processingTime: '3-5 business days'
    };
  }

  /**
   * Update user's referral settings
   */
  async updateReferralSettings(userId: string, dto: UpdateReferralSettingsDto): Promise<ReferralSettingsResponseDto> {
    const settings = await this.referralsRepository.createOrUpdateSettings(userId, dto as Record<string, unknown>);

    this.logger.log('Referral settings updated', { userId });

    return {
      id: (settings as unknown as { _id: { toString: () => string } })._id?.toString() || '',
      userId: settings.userId.toString(),
      emailNotifications: settings.emailNotifications,
      pushNotifications: settings.pushNotifications,
      createdAt: settings.createdAt || new Date(),
      updatedAt: settings.updatedAt || new Date()
    };
  }

  /**
   * Process pending rewards (called by cron job)
   */
  async processPendingRewards(): Promise<void> {
    const pendingRewards = await this.referralsRepository.findPendingRewardsToActivate();

    for (const reward of pendingRewards) {
      try {
        await this.referralsRepository.updateRewardStatus([(reward as any)._id.toString()], RewardStatus.AVAILABLE);
        this.logger.log('Reward activated', {
          rewardId: (reward as any)._id.toString(),
          userId: reward.userId.toString()
        });
      } catch (error) {
        this.logger.error('Failed to activate reward', {
          rewardId: (reward as any)._id.toString(),
          error: error.message
        });
      }
    }
  }
}
