import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReferralRewardRepository } from './referral-reward.repository';
import { ReferralsService } from './referrals.service';
import { RewardStatus } from './schemas/referral-reward.schema';

@Injectable()
export class ReferralCronService {
  private readonly logger = new Logger(ReferralCronService.name);
  private readonly isEnabled: boolean;

  constructor(
    private readonly referralsService: ReferralsService,
    private readonly configService: ConfigService,
    private readonly referralRewardRepository: ReferralRewardRepository
  ) {
    // Allow disabling cron jobs in development/testing
    this.isEnabled = this.configService.get('app.env') !== 'test';
  }

  /**
   * Daily cron job to update active days count for users
   * Runs every day at 1:00 AM UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'updateActiveDays',
    timeZone: 'UTC'
  })
  async updateActiveDaysCount(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      this.logger.log('Starting daily active days update...');

      const startTime = Date.now();
      await this.referralsService.updateActiveDaysCount();
      const duration = Date.now() - startTime;

      this.logger.log(`Daily active days update completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Error updating active days count:', error);
    }
  }

  /**
   * Daily cron job to complete referrals for eligible users
   * Runs every day at 2:00 AM UTC (after active days update)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'completeReferrals',
    timeZone: 'UTC'
  })
  async completeEligibleReferrals(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      this.logger.log('Starting referral completion check...');

      const startTime = Date.now();
      await this.referralsService.completeReferralsForActiveUsers();
      const duration = Date.now() - startTime;

      this.logger.log(`Referral completion check completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Error completing referrals:', error);
    }
  }

  /**
   * Weekly cron job for referral system maintenance
   * Runs every Sunday at 3:00 AM UTC
   */
  @Cron('0 3 * * 0', {
    name: 'weeklyMaintenance',
    timeZone: 'UTC'
  })
  async weeklyMaintenance(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      this.logger.log('Starting weekly referral maintenance...');

      // Clean expired rewards using repository
      const result = await this.referralRewardRepository.markRewardsAsExpired();

      this.logger.log(`Marked ${result.modifiedCount} rewards as expired`);

      this.logger.log('Weekly referral maintenance completed');
    } catch (error) {
      this.logger.error('Error during weekly maintenance:', error);
    }
  }

  /**
   * Manual trigger for active days update (for testing/admin use)
   */
  async triggerActiveDaysUpdate(): Promise<void> {
    this.logger.log('Manual trigger: Updating active days count...');
    await this.updateActiveDaysCount();
  }

  /**
   * Manual trigger for referral completion (for testing/admin use)
   */
  async triggerReferralCompletion(): Promise<void> {
    this.logger.log('Manual trigger: Completing eligible referrals...');
    await this.completeEligibleReferrals();
  }

  /**
   * Get cron job status information
   */
  getStatus(): {
    enabled: boolean;
    environment: string;
    scheduledJobs: Array<{ name: string; nextRun: string; description: string }>;
  } {
    const env = this.configService.get('app.env');

    return {
      enabled: this.isEnabled,
      environment: env,
      scheduledJobs: [
        {
          name: 'updateActiveDays',
          nextRun: 'Daily at 1:00 AM UTC',
          description: 'Updates active days count for users who were active the previous day'
        },
        {
          name: 'completeReferrals',
          nextRun: 'Daily at 2:00 AM UTC',
          description: 'Completes referrals for users who have reached the required active days'
        },
        {
          name: 'weeklyMaintenance',
          nextRun: 'Every Sunday at 3:00 AM UTC',
          description: 'Performs weekly maintenance tasks for the referral system'
        }
      ]
    };
  }
}
