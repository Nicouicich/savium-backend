import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { BudgetsRepository } from './budgets.repository';
import { BudgetQueryService, BudgetCommandService } from './services';
import { Budget, BudgetSchema } from './schemas/budget.schema';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Budget.name, schema: BudgetSchema }]), AccountsModule, CategoriesModule, TransactionsModule, UsersModule],
  controllers: [BudgetsController],
  providers: [BudgetsRepository, BudgetQueryService, BudgetCommandService, BudgetsService],
  exports: [BudgetsService]
})
export class BudgetsModule {}
