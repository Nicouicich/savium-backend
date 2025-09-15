import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralCronService } from './referral-cron.service';

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

  providers: [ReferralsService, ReferralCronService],

  exports: [ReferralsService, ReferralCronService]
})
export class ReferralsModule {}
