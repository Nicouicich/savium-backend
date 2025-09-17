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
import { ExpenseContextParserService } from '../common/services/expense-context-parser.service';

import { Account, AccountSchema } from './schemas/account.schema';
import { CoupleSettings, CoupleSettingsSchema } from './schemas/couple-settings.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: CoupleSettings.name, schema: CoupleSettingsSchema },
      { name: User.name, schema: UserSchema },
      { name: Expense.name, schema: ExpenseSchema }
    ])
  ],
  controllers: [AccountsController, CoupleController],
  providers: [AccountsService, AccountsRepository, CoupleService, GiftModeService, CoupleAnalyticsService, CouplePremiumService, ExpenseContextParserService],
  exports: [AccountsService, AccountsRepository, CoupleService, GiftModeService, CoupleAnalyticsService, CouplePremiumService, ExpenseContextParserService]
})
export class AccountsModule {}
