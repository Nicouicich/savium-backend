import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CategoryBreakdownDto,
  CategoryReportDto,
  ExportReportDto,
  MonthlyBreakdownDto,
  MonthlyReportDto,
  ReportMetadataDto,
  ReportPeriod,
  ReportQueryDto,
  ReportType,
  SummaryReportDto,
  SummaryStatsDto,
  UserBreakdownDto
} from './dto';
import { TransactionsService } from '../transactions/transactions.service';
import { CategoriesService } from '../categories/categories.service';
import { UsersService } from '../users/users.service';
import { Currency } from '@common/constants/transaction-categories';
import { EnhancedCacheService } from '@common/services/enhanced-cache.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly cacheService: EnhancedCacheService,
    private readonly transactionsService: TransactionsService,
    private readonly categoriesService: CategoriesService,
    private readonly usersService: UsersService
  ) {}

}
