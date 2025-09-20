import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TransactionsModule } from '../transactions/transactions.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { CommonModule } from '@common/common.module';

@Module({
  imports: [TransactionsModule, ProfilesModule, CategoriesModule, UsersModule, CommonModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService]
})
export class ReportsModule {}
