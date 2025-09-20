import { CommonModule } from '@common/common.module';
import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TransactionsModule, CategoriesModule, UsersModule, CommonModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService]
})
export class ReportsModule {}
