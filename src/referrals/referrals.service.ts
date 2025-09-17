import { Injectable } from '@nestjs/common';
import { ReferralQueryService, ReferralCommandService } from './services';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import { ReferralCodeResponseDto } from './dto/referral-code-response.dto';
import { ValidateReferralResponseDto } from './dto/validate-referral-response.dto';
import { ReferralStatsQueryDto } from './dto/referral-stats-query.dto';
import { ReferralStatsResponseDto } from './dto/referral-stats-response.dto';
import { ReferralHistoryQueryDto } from './dto/referral-history-query.dto';
import { ReferralHistoryResponseDto } from './dto/referral-history-response.dto';
import { RewardsQueryDto } from './dto/rewards-query.dto';
import { RewardsResponseDto } from './dto/rewards-response.dto';
import { RedeemRewardsDto, RedeemRewardsResponseDto } from './dto/redeem-rewards.dto';
import { UpdateReferralSettingsDto, ReferralSettingsResponseDto } from './dto/referral-settings.dto';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly referralQueryService: ReferralQueryService,
    private readonly referralCommandService: ReferralCommandService
  ) {}

  /**
   * Get user's referral code and statistics
   */
  async getMyReferralCode(userId: string): Promise<ReferralCodeResponseDto> {
    try {
      return await this.referralQueryService.getMyReferralCode(userId);
    } catch (error) {
      if (error.message === 'Referral code not found') {
        // Generate referral code first
        await this.referralCommandService.generateReferralCode(userId);
        return this.referralQueryService.getMyReferralCode(userId);
      }
      throw error;
    }
  }

  /**
   * Apply a referral code to a user
   */
  async applyReferralCode(userId: string, dto: ApplyReferralDto): Promise<{ success: boolean; message: string; referrerInfo?: any }> {
    return this.referralCommandService.applyReferralCode(userId, dto);
  }

  /**
   * Validate a referral code
   */
  async validateReferralCode(code: string): Promise<ValidateReferralResponseDto> {
    return this.referralQueryService.validateReferralCode(code);
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string, query: ReferralStatsQueryDto): Promise<ReferralStatsResponseDto> {
    return this.referralQueryService.getReferralStats(userId, query);
  }

  /**
   * Get referral history for a user
   */
  async getReferralHistory(userId: string, query: ReferralHistoryQueryDto): Promise<ReferralHistoryResponseDto> {
    return this.referralQueryService.getReferralHistory(userId, query);
  }

  /**
   * Get user's rewards
   */
  async getRewards(userId: string, query: RewardsQueryDto): Promise<RewardsResponseDto> {
    return this.referralQueryService.getRewards(userId, query);
  }

  /**
   * Redeem available rewards
   */
  async redeemRewards(userId: string, dto: RedeemRewardsDto): Promise<RedeemRewardsResponseDto> {
    return this.referralCommandService.redeemRewards(userId, dto);
  }

  /**
   * Get user's referral settings
   */
  async getReferralSettings(userId: string): Promise<ReferralSettingsResponseDto> {
    return this.referralQueryService.getReferralSettings(userId);
  }

  /**
   * Update user's referral settings
   */
  async updateReferralSettings(userId: string, dto: UpdateReferralSettingsDto): Promise<ReferralSettingsResponseDto> {
    return this.referralCommandService.updateReferralSettings(userId, dto);
  }

  /**
   * Generate referral code for a user
   */
  async generateReferralCode(userId: string): Promise<string> {
    return this.referralCommandService.generateReferralCode(userId);
  }

  /**
   * Mark a referral as completed (trigger reward activation)
   */
  async completeReferral(userId: string): Promise<void> {
    return this.referralCommandService.completeReferral(userId);
  }

  /**
   * Process pending rewards (called by cron job)
   */
  async processPendingRewards(): Promise<void> {
    return this.referralCommandService.processPendingRewards();
  }

  /**
   * Mark user as active (for referral completion tracking)
   */
  async markUserActive(userId: string): Promise<void> {
    // This would be implemented based on business logic
    // For now, we'll just complete the referral
    return this.referralCommandService.completeReferral(userId);
  }

  /**
   * Update active days count (for cron job)
   */
  async updateActiveDaysCount(): Promise<void> {
    // This would be implemented based on business logic
    // Placeholder for now
  }

  /**
   * Complete referrals for active users (for cron job)
   */
  async completeReferralsForActiveUsers(): Promise<void> {
    // This would be implemented based on business logic
    // Placeholder for now
  }
}
