import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsRepository } from './budgets.repository';
import { BudgetsService } from './budgets.service';
import { Budget, BudgetSchema } from './schemas/budget.schema';
import { BudgetCommandService, BudgetQueryService } from './services';

@Module({
  imports: [MongooseModule.forFeature([{ name: Budget.name, schema: BudgetSchema }]), CategoriesModule, TransactionsModule, UsersModule],
  controllers: [BudgetsController],
  providers: [BudgetsRepository, BudgetQueryService, BudgetCommandService, BudgetsService],
  exports: [BudgetsService]
})
export class BudgetsModule {}
