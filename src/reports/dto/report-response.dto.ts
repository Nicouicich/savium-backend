import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Currency} from '@common/constants/expense-categories';

export class CategoryBreakdownDto {
  @ApiProperty({description: 'Category ID'})
  categoryId: string;

  @ApiProperty({description: 'Category name'})
  categoryName: string;

  @ApiProperty({description: 'Category icon'})
  categoryIcon: string;

  @ApiProperty({description: 'Category color'})
  categoryColor: string;

  @ApiProperty({description: 'Total amount spent'})
  totalAmount: number;

  @ApiProperty({description: 'Number of expenses'})
  expenseCount: number;

  @ApiProperty({description: 'Percentage of total spending'})
  percentage: number;

  @ApiPropertyOptional({description: 'Comparison with previous period'})
  comparison?: {
    previousAmount: number;
    changeAmount: number;
    changePercentage: number;
  };
}

export class MonthlyBreakdownDto {
  @ApiProperty({description: 'Year'})
  year: number;

  @ApiProperty({description: 'Month'})
  month: number;

  @ApiProperty({description: 'Month name'})
  monthName: string;

  @ApiProperty({description: 'Total amount spent'})
  totalAmount: number;

  @ApiProperty({description: 'Number of expenses'})
  expenseCount: number;

  @ApiProperty({description: 'Average expense amount'})
  averageAmount: number;

  @ApiPropertyOptional({description: 'Comparison with previous month'})
  comparison?: {
    previousAmount: number;
    changeAmount: number;
    changePercentage: number;
  };
}

export class UserBreakdownDto {
  @ApiProperty({description: 'User ID'})
  userId: string;

  @ApiProperty({description: 'User name'})
  userName: string;

  @ApiProperty({description: 'User email'})
  userEmail: string;

  @ApiProperty({description: 'Total amount spent'})
  totalAmount: number;

  @ApiProperty({description: 'Number of expenses'})
  expenseCount: number;

  @ApiProperty({description: 'Percentage of total spending'})
  percentage: number;
}

export class SummaryStatsDto {
  @ApiProperty({description: 'Total amount spent'})
  totalAmount: number;

  @ApiProperty({description: 'Total number of expenses'})
  totalExpenses: number;

  @ApiProperty({description: 'Average expense amount'})
  averageAmount: number;

  @ApiProperty({description: 'Highest single expense'})
  maxAmount: number;

  @ApiProperty({description: 'Lowest single expense'})
  minAmount: number;

  @ApiProperty({description: 'Currency used'})
  currency: Currency;

  @ApiProperty({description: 'Number of different categories used'})
  categoriesUsed: number;

  @ApiProperty({description: 'Number of active days (days with expenses)'})
  activeDays: number;

  @ApiPropertyOptional({description: 'Comparison with previous period'})
  comparison?: {
    previousAmount: number;
    changeAmount: number;
    changePercentage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

export class ReportMetadataDto {
  @ApiProperty({description: 'Report generation timestamp'})
  generatedAt: Date;

  @ApiProperty({description: 'Report period start date'})
  periodStart: Date;

  @ApiProperty({description: 'Report period end date'})
  periodEnd: Date;

  @ApiProperty({description: 'Account ID'})
  accountId: string;

  @ApiProperty({description: 'Account name'})
  accountName: string;

  @ApiProperty({description: 'User who requested the report'})
  requestedBy: string;

  @ApiProperty({description: 'Report type'})
  reportType: string;

  @ApiProperty({description: 'Currency'})
  currency: Currency;

  @ApiPropertyOptional({description: 'Applied filters'})
  filters?: Record<string, any>;
}

export class MonthlyReportDto {
  @ApiProperty({description: 'Report metadata'})
  metadata: ReportMetadataDto;

  @ApiProperty({description: 'Summary statistics'})
  summary: SummaryStatsDto;

  @ApiProperty({description: 'Daily breakdown', type: [MonthlyBreakdownDto]})
  dailyBreakdown: Array<{
    date: string;
    totalAmount: number;
    expenseCount: number;
  }>;

  @ApiProperty({
    description: 'Category breakdown',
    type: [CategoryBreakdownDto]
  })
  categoryBreakdown: CategoryBreakdownDto[];

  @ApiProperty({description: 'Top expenses'})
  topExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    date: Date;
    categoryName: string;
    vendor?: string;
  }>;
}

export class CategoryReportDto {
  @ApiProperty({description: 'Report metadata'})
  metadata: ReportMetadataDto;

  @ApiProperty({description: 'Summary statistics'})
  summary: SummaryStatsDto;

  @ApiProperty({
    description: 'Category breakdown',
    type: [CategoryBreakdownDto]
  })
  categories: CategoryBreakdownDto[];

  @ApiProperty({description: 'Monthly trends by category'})
  monthlyTrends: Array<{
    categoryId: string;
    categoryName: string;
    monthlyData: MonthlyBreakdownDto[];
  }>;
}

export class SummaryReportDto {
  @ApiProperty({description: 'Report metadata'})
  metadata: ReportMetadataDto;

  @ApiProperty({description: 'Summary statistics'})
  summary: SummaryStatsDto;

  @ApiProperty({
    description: 'Category breakdown',
    type: [CategoryBreakdownDto]
  })
  categoryBreakdown: CategoryBreakdownDto[];

  @ApiProperty({
    description: 'Monthly breakdown',
    type: [MonthlyBreakdownDto]
  })
  monthlyBreakdown: MonthlyBreakdownDto[];

  @ApiPropertyOptional({
    description: 'User breakdown for shared accounts',
    type: [UserBreakdownDto]
  })
  userBreakdown?: UserBreakdownDto[];

  @ApiProperty({description: 'Key insights and recommendations'})
  insights: Array<{
    type: 'warning' | 'info' | 'success' | 'trend';
    title: string;
    description: string;
    value?: number;
    recommendation?: string;
  }>;
}

export class ExportReportDto {
  @ApiProperty({description: 'Export file URL'})
  fileUrl: string;

  @ApiProperty({description: 'Export format'})
  format: string;

  @ApiProperty({description: 'File size in bytes'})
  fileSize: number;

  @ApiProperty({description: 'Export expiration date'})
  expiresAt: Date;

  @ApiProperty({description: 'Download token for secure access'})
  downloadToken: string;
}
