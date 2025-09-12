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
import { ExpensesService } from '../expenses/expenses.service';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { UsersService } from '../users/users.service';
import { Currency } from '@common/constants/expense-categories';
import { EnhancedCacheService } from '@common/services/enhanced-cache.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly cacheService: EnhancedCacheService,
    private readonly expensesService: ExpensesService,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
    private readonly usersService: UsersService
  ) {}

  async generateMonthlyReport(query: ReportQueryDto, userId: string): Promise<MonthlyReportDto> {
    // Generate cache key for this specific report
    const cacheKey = this.generateCacheKey('monthly', query, userId);

    return this.cacheService.cacheQuery(
      cacheKey,
      async () => {
        return this.generateMonthlyReportData(query, userId);
      },
      {
        ttl: 3600, // 1 hour
        namespace: 'reports',
        tags: [`account:${query.accountId}`, 'reports'],
        compress: true
      }
    );
  }

  private async generateMonthlyReportData(query: ReportQueryDto, userId: string): Promise<MonthlyReportDto> {
    // Validate access to account
    await this.validateAccountAccess(query.accountId!, userId);

    // Calculate date range
    const { startDate, endDate } = this.calculateDateRange(query.period!, query.startDate, query.endDate);

    // Generate report metadata
    const metadata = await this.generateReportMetadata(query.accountId!, userId, ReportType.MONTHLY, startDate, endDate, query.currency, query);

    // Get summary statistics
    const summary = await this.generateSummaryStats(query.accountId!, startDate, endDate, query.currency as Currency, query.includeComparison);

    // Get daily breakdown
    const dailyBreakdown = await this.generateDailyBreakdown(query.accountId!, startDate, endDate);

    // Get category breakdown
    const categoryBreakdown = await this.expensesService.getCategoryBreakdown(query.accountId!, userId, startDate, endDate);

    // Get top expenses
    const topExpenses = await this.getTopExpenses(query.accountId!, startDate, endDate, 10);

    return {
      metadata,
      summary,
      dailyBreakdown,
      categoryBreakdown: await Promise.all(
        categoryBreakdown.map(async cat => ({
          ...cat,
          comparison: query.includeComparison ? await this.calculateCategoryComparison(cat.categoryId, query.accountId!, startDate, endDate) : undefined
        }))
      ),
      topExpenses
    };
  }

  async generateCategoryReport(query: ReportQueryDto, userId: string): Promise<CategoryReportDto> {
    const cacheKey = this.generateCacheKey('category', query, userId);

    return this.cacheService.cacheQuery(
      cacheKey,
      async () => {
        return this.generateCategoryReportData(query, userId);
      },
      {
        ttl: 3600, // 1 hour
        namespace: 'reports',
        tags: [`account:${query.accountId}`, 'reports'],
        compress: true
      }
    );
  }

  private async generateCategoryReportData(query: ReportQueryDto, userId: string): Promise<CategoryReportDto> {
    await this.validateAccountAccess(query.accountId!, userId);

    const { startDate, endDate } = this.calculateDateRange(query.period!, query.startDate, query.endDate);

    const metadata = await this.generateReportMetadata(query.accountId!, userId, ReportType.CATEGORY, startDate, endDate, query.currency, query);

    const summary = await this.generateSummaryStats(query.accountId!, startDate, endDate, query.currency as Currency, query.includeComparison);

    // Get detailed category breakdown
    const categories = await this.expensesService.getCategoryBreakdown(query.accountId!, userId, startDate, endDate);

    // Get monthly trends by category
    const monthlyTrends = await this.generateCategoryTrends(query.accountId!, startDate, endDate, query.months || 6);

    return {
      metadata,
      summary,
      categories: await Promise.all(
        categories.map(async cat => ({
          ...cat,
          comparison: query.includeComparison ? await this.calculateCategoryComparison(cat.categoryId, query.accountId!, startDate, endDate) : undefined
        }))
      ),
      monthlyTrends
    };
  }

  async generateSummaryReport(query: ReportQueryDto, userId: string): Promise<SummaryReportDto> {
    const cacheKey = this.generateCacheKey('summary', query, userId);

    return this.cacheService.cacheQuery(
      cacheKey,
      async () => {
        return this.generateSummaryReportData(query, userId);
      },
      {
        ttl: 3600, // 1 hour
        namespace: 'reports',
        tags: [`account:${query.accountId}`, 'reports'],
        compress: true
      }
    );
  }

  private async generateSummaryReportData(query: ReportQueryDto, userId: string): Promise<SummaryReportDto> {
    await this.validateAccountAccess(query.accountId!, userId);

    const { startDate, endDate } = this.calculateDateRange(query.period!, query.startDate, query.endDate);

    const metadata = await this.generateReportMetadata(query.accountId!, userId, ReportType.SUMMARY, startDate, endDate, query.currency, query);

    const summary = await this.generateSummaryStats(query.accountId!, startDate, endDate, query.currency as Currency, query.includeComparison);

    const categoryBreakdown = await this.expensesService.getCategoryBreakdown(query.accountId!, userId, startDate, endDate);

    const monthlyBreakdown = await this.expensesService.getMonthlyTrends(query.accountId!, userId, query.months || 12);

    // Get user breakdown if this is a shared account
    let userBreakdown: UserBreakdownDto[] | undefined;
    if (query.groupByUser) {
      userBreakdown = await this.generateUserBreakdown(query.accountId!, startDate, endDate);
    }

    // Generate insights and recommendations
    const insights = await this.generateInsights(
      summary,
      categoryBreakdown,
      monthlyBreakdown.map(trend => ({
        year: trend.year,
        month: trend.month,
        monthName: this.getMonthName(trend.month),
        totalAmount: trend.totalAmount,
        expenseCount: trend.expenseCount,
        averageAmount: trend.averageAmount
      }))
    );

    return {
      metadata,
      summary,
      categoryBreakdown: await Promise.all(
        categoryBreakdown.map(async cat => ({
          ...cat,
          comparison: query.includeComparison ? await this.calculateCategoryComparison(cat.categoryId, query.accountId!, startDate, endDate) : undefined
        }))
      ),
      monthlyBreakdown: monthlyBreakdown.map(trend => ({
        year: trend.year,
        month: trend.month,
        monthName: this.getMonthName(trend.month),
        totalAmount: trend.totalAmount,
        expenseCount: trend.expenseCount,
        averageAmount: trend.averageAmount
      })),
      userBreakdown,
      insights
    };
  }

  async exportReport(query: ReportQueryDto, userId: string): Promise<ExportReportDto> {
    // Validate access
    await this.validateAccountAccess(query.accountId!, userId);

    // Generate the appropriate report based on type
    let report: any;
    switch (query.type) {
      case ReportType.MONTHLY:
        report = await this.generateMonthlyReport(query, userId);
        break;
      case ReportType.CATEGORY:
        report = await this.generateCategoryReport(query, userId);
        break;
      case ReportType.SUMMARY:
        report = await this.generateSummaryReport(query, userId);
        break;
      default:
        throw new BadRequestException('Invalid report type for export');
    }

    // For now, we'll simulate the export process
    // In a real implementation, you would generate the actual file based on the format
    const fileName = `report-${query.type}-${Date.now()}`;
    const fileExtension = this.getFileExtension(query.format!);
    const fullFileName = `${fileName}.${fileExtension}`;

    // Simulate file creation and return metadata
    const exportResult: ExportReportDto = {
      fileUrl: `/exports/${fullFileName}`,
      format: query.format!,
      fileSize: this.estimateFileSize(report, query.format!),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      downloadToken: this.generateDownloadToken(fullFileName, userId)
    };

    // Cache export metadata for tracking
    await this.cacheService.set(
      `export:${exportResult.downloadToken}`,
      { report, metadata: exportResult },
      {
        ttl: 86400, // 24 hours
        namespace: 'exports',
        tags: [`account:${query.accountId}`, 'exports']
      }
    );

    return exportResult;
  }

  async clearReportsCache(accountId?: string): Promise<void> {
    if (accountId) {
      // Clear cache for specific account
      await this.cacheService.invalidateAccountCache(accountId);
      await this.cacheService.invalidateByTags([`account:${accountId}`, 'reports']);
    } else {
      // Clear all report cache
      await this.cacheService.invalidateByTags(['reports']);
    }
  }

  private async validateAccountAccess(accountId: string, userId: string): Promise<void> {
    const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this account');
    }
  }

  private calculateDateRange(period: ReportPeriod, customStartDate?: string, customEndDate?: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    switch (period) {
      case ReportPeriod.LAST_MONTH:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case ReportPeriod.LAST_3_MONTHS:
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case ReportPeriod.LAST_6_MONTHS:
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;
      case ReportPeriod.LAST_YEAR:
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case ReportPeriod.CUSTOM:
        if (!customStartDate || !customEndDate) {
          throw new BadRequestException('Start and end dates are required for custom period');
        }
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
  }

  private async generateReportMetadata(
    accountId: string,
    userId: string,
    reportType: ReportType,
    startDate: Date,
    endDate: Date,
    currency?: string,
    filters?: ReportQueryDto
  ): Promise<ReportMetadataDto> {
    const account = await this.accountsService.findById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      generatedAt: new Date(),
      periodStart: startDate,
      periodEnd: endDate,
      accountId,
      accountName: account.name,
      requestedBy: `${user.firstName} ${user.lastName}`,
      reportType,
      currency: (currency as Currency) || Currency.USD,
      filters: filters
        ? {
            categoryIds: filters.categoryIds,
            includeComparison: filters.includeComparison,
            groupByUser: filters.groupByUser
          }
        : undefined
    };
  }

  private async generateSummaryStats(
    accountId: string,
    startDate: Date,
    endDate: Date,
    currency?: Currency,
    includeComparison = false
  ): Promise<SummaryStatsDto> {
    const stats = await this.expensesService.getExpenseStats(
      accountId,
      undefined, // Don't filter by user for account-level stats
      startDate,
      endDate,
      currency
    );

    // Get additional stats
    const categoryBreakdown = await this.expensesService.getCategoryBreakdown(
      accountId,
      '', // Empty string to bypass user check since we already validated access
      startDate,
      endDate
    );

    const activeDays = await this.calculateActiveDays(accountId, startDate, endDate);

    let comparison;
    if (includeComparison) {
      comparison = await this.calculatePeriodComparison(accountId, startDate, endDate, currency);
    }

    return {
      totalAmount: stats.totalAmount,
      totalExpenses: stats.totalExpenses,
      averageAmount: stats.averageAmount,
      maxAmount: stats.maxAmount,
      minAmount: stats.minAmount,
      currency: stats.currency,
      categoriesUsed: categoryBreakdown.length,
      activeDays,
      comparison
    };
  }

  private async generateDailyBreakdown(
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; totalAmount: number; expenseCount: number }>> {
    // This would require a more complex aggregation query
    // For now, we'll return a simplified version
    const expenses = await this.expensesService.findByAccount(accountId, {
      startDate,
      endDate,
      limit: 1000
    });

    const dailyMap = new Map<string, { totalAmount: number; expenseCount: number }>();

    expenses.data.forEach(expense => {
      const dateStr = expense.date.toISOString().split('T')[0];
      const existing = dailyMap.get(dateStr) || {
        totalAmount: 0,
        expenseCount: 0
      };
      existing.totalAmount += expense.amount;
      existing.expenseCount += 1;
      dailyMap.set(dateStr, existing);
    });

    return Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      ...stats
    }));
  }

  private async getTopExpenses(
    accountId: string,
    startDate: Date,
    endDate: Date,
    limit: number
  ): Promise<
    Array<{
      id: string;
      description: string;
      amount: number;
      date: Date;
      categoryName: string;
      vendor?: string;
    }>
  > {
    const expenses = await this.expensesService.findByAccount(accountId, {
      startDate,
      endDate,
      limit,
      sortBy: 'amount',
      sortOrder: 'desc'
    });

    return expenses.data.slice(0, limit).map(expense => ({
      id: (expense as any)._id.toString(),
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      categoryName: (expense.categoryId as any)?.displayName || 'Unknown',
      vendor: expense.vendor
    }));
  }

  private async generateCategoryTrends(
    accountId: string,
    startDate: Date,
    endDate: Date,
    months: number
  ): Promise<
    Array<{
      categoryId: string;
      categoryName: string;
      monthlyData: MonthlyBreakdownDto[];
    }>
  > {
    // This would require complex aggregation queries
    // For now, return empty array as placeholder
    return [];
  }

  private async calculateCategoryComparison(
    categoryId: string,
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    | {
        previousAmount: number;
        changeAmount: number;
        changePercentage: number;
      }
    | undefined
  > {
    // Calculate previous period dates
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(startDate.getTime() - periodLength);

    // Get current and previous period stats for this category
    const currentExpenses = await this.expensesService.findByCategory(categoryId, accountId);
    const currentAmount = currentExpenses.filter(exp => exp.date >= startDate && exp.date <= endDate).reduce((sum, exp) => sum + exp.amount, 0);

    const previousAmount = currentExpenses.filter(exp => exp.date >= prevStartDate && exp.date <= prevEndDate).reduce((sum, exp) => sum + exp.amount, 0);

    const changeAmount = currentAmount - previousAmount;
    const changePercentage = previousAmount > 0 ? (changeAmount / previousAmount) * 100 : 0;

    return {
      previousAmount,
      changeAmount,
      changePercentage
    };
  }

  private async calculatePeriodComparison(
    accountId: string,
    startDate: Date,
    endDate: Date,
    currency?: Currency
  ): Promise<{
    previousAmount: number;
    changeAmount: number;
    changePercentage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(startDate.getTime() - periodLength);

    const prevStats = await this.expensesService.getExpenseStats(accountId, undefined, prevStartDate, prevEndDate, currency);

    const currentStats = await this.expensesService.getExpenseStats(accountId, undefined, startDate, endDate, currency);

    const changeAmount = currentStats.totalAmount - prevStats.totalAmount;
    const changePercentage = prevStats.totalAmount > 0 ? (changeAmount / prevStats.totalAmount) * 100 : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(changePercentage) > 5) {
      trend = changePercentage > 0 ? 'increasing' : 'decreasing';
    }

    return {
      previousAmount: prevStats.totalAmount,
      changeAmount,
      changePercentage,
      trend
    };
  }

  private async generateUserBreakdown(accountId: string, startDate: Date, endDate: Date): Promise<UserBreakdownDto[]> {
    // This would require aggregating expenses by user within the account
    // For now, return empty array as placeholder
    return [];
  }

  private async calculateActiveDays(accountId: string, startDate: Date, endDate: Date): Promise<number> {
    const expenses = await this.expensesService.findByAccount(accountId, {
      startDate,
      endDate,
      limit: 10000
    });

    const uniqueDays = new Set(expenses.data.map(expense => expense.date.toISOString().split('T')[0]));

    return uniqueDays.size;
  }

  private async generateInsights(
    summary: SummaryStatsDto,
    categoryBreakdown: any[],
    monthlyBreakdown: MonthlyBreakdownDto[]
  ): Promise<
    Array<{
      type: 'warning' | 'info' | 'success' | 'trend';
      title: string;
      description: string;
      value?: number;
      recommendation?: string;
    }>
  > {
    const insights: Array<{
      type: 'warning' | 'info' | 'success' | 'trend';
      title: string;
      description: string;
      value?: number;
      recommendation?: string;
    }> = [];

    // High spending category insight
    if (categoryBreakdown.length > 0) {
      const topCategory = categoryBreakdown[0];
      if (topCategory.percentage > 40) {
        insights.push({
          type: 'warning' as const,
          title: 'High Category Concentration',
          description: `${topCategory.percentage.toFixed(1)}% of spending is in ${topCategory.categoryName}`,
          value: topCategory.percentage,
          recommendation: 'Consider reviewing expenses in this category for potential savings'
        });
      }
    }

    // Trend insights
    if (summary.comparison) {
      if (summary.comparison.trend === 'increasing' && summary.comparison.changePercentage > 20) {
        insights.push({
          type: 'warning' as const,
          title: 'Spending Increase',
          description: `Spending increased by ${summary.comparison.changePercentage.toFixed(1)}% compared to previous period`,
          value: summary.comparison.changePercentage,
          recommendation: 'Review recent expenses to identify areas for cost reduction'
        });
      } else if (summary.comparison.trend === 'decreasing') {
        insights.push({
          type: 'success' as const,
          title: 'Spending Reduction',
          description: `Great job! Spending decreased by ${Math.abs(summary.comparison.changePercentage).toFixed(1)}%`,
          value: Math.abs(summary.comparison.changePercentage)
        });
      }
    }

    // Average expense insight
    if (summary.averageAmount > 0) {
      insights.push({
        type: 'info' as const,
        title: 'Average Expense',
        description: `Your average expense is $${summary.averageAmount.toFixed(2)}`,
        value: summary.averageAmount
      });
    }

    return insights;
  }

  private getMonthName(month: number): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  }

  private generateCacheKey(type: string, query: ReportQueryDto, userId: string): string {
    const keyParts = [
      'report',
      type,
      query.accountId || 'no-account',
      query.period || 'no-period',
      query.startDate || 'no-start',
      query.endDate || 'no-end',
      query.currency || 'no-currency',
      query.includeComparison || false,
      userId
    ];
    return keyParts.join(':');
  }

  private async getCacheKeys(pattern: string): Promise<string[]> {
    // This is a simplified implementation
    // In a real Redis implementation, you would use the SCAN command
    return [];
  }

  private getFileExtension(format: string): string {
    switch (format.toLowerCase()) {
      case 'pdf':
        return 'pdf';
      case 'csv':
        return 'csv';
      case 'excel':
        return 'xlsx';
      case 'json':
        return 'json';
      default:
        return 'pdf';
    }
  }

  private estimateFileSize(report: any, format: string): number {
    // Rough estimate based on report size and format
    const jsonSize = JSON.stringify(report).length;
    switch (format.toLowerCase()) {
      case 'pdf':
        return jsonSize * 2;
      case 'csv':
        return jsonSize * 0.7;
      case 'excel':
        return jsonSize * 1.5;
      case 'json':
        return jsonSize;
      default:
        return jsonSize;
    }
  }

  private generateDownloadToken(fileName: string, userId: string): string {
    // In a real implementation, you would use a proper token generation mechanism
    const timestamp = Date.now();
    return Buffer.from(`${fileName}:${userId}:${timestamp}`).toString('base64');
  }
}
