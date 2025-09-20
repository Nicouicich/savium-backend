import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

import { ReferralCronService } from './referral-cron.service';
import { ReferralRewardRepository } from './referral-reward.repository';
import { ReferralsController } from './referrals.controller';
import { ReferralsRepository } from './referrals.repository';
import { ReferralsService } from './referrals.service';
import { ReferralCommandService, ReferralQueryService } from './services';

// Import schemas
import { User, UserSchema } from '../users/schemas/user.schema';
import { ReferralReward, ReferralRewardSchema } from './schemas/referral-reward.schema';
import { ReferralSettings, ReferralSettingsSchema } from './schemas/referral-settings.schema';

// Import common modules
import { CommonModule } from '@common/common.module';

@Module({
  imports: [
    ConfigModule,

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

    // Mongoose schemas
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ReferralReward.name, schema: ReferralRewardSchema },
      { name: ReferralSettings.name, schema: ReferralSettingsSchema }
    ]),

    // Common utilities and services
    CommonModule
  ],

  controllers: [ReferralsController],

  providers: [ReferralsRepository, ReferralRewardRepository, ReferralQueryService, ReferralCommandService, ReferralsService, ReferralCronService],

  exports: [ReferralsRepository, ReferralRewardRepository, ReferralsService, ReferralCronService]
})
export class ReferralsModule {}
