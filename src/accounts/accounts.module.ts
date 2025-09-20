import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountsRepository } from './accounts.repository';

// Couple-specific imports
import { CoupleController } from './controllers/couple.controller';
import { CoupleService } from './services/couple.service';
import { GiftModeService } from './services/gift-mode.service';
import { CoupleAnalyticsService } from './services/couple-analytics.service';
import { CouplePremiumService } from './services/couple-premium.service';

// Common services
import { ProfilesModule } from '../profiles/profiles.module';

import { Account, AccountSchema } from './schemas/account.schema';
import { CoupleSettings, CoupleSettingsSchema } from './schemas/couple-settings.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';
import { Profile, ProfileSchema } from '../profiles/schemas/profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: CoupleSettings.name, schema: CoupleSettingsSchema },
      { name: User.name, schema: UserSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Profile.name, schema: ProfileSchema }
    ]),
    ProfilesModule
  ],
  controllers: [AccountsController, CoupleController],
  providers: [AccountsService, AccountsRepository, CoupleService, GiftModeService, CoupleAnalyticsService, CouplePremiumService],
  exports: [AccountsService, AccountsRepository, CoupleService, GiftModeService, CoupleAnalyticsService, CouplePremiumService]
})
export class AccountsModule {}
