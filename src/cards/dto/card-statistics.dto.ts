import { IsOptional, IsEnum, IsDateString, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatsPeriod } from '@common/constants/card-types';

export class CardStatisticsQueryDto {
  @ApiPropertyOptional({
    description: 'Statistics period',
    enum: StatsPeriod,
    example: StatsPeriod.MONTH
  })
  @IsOptional()
  @IsEnum(StatsPeriod, { message: 'Invalid statistics period' })
  period?: StatsPeriod;

  @ApiPropertyOptional({
    description: 'Custom start date for statistics',
    example: '2023-01-01T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid date' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Custom end date for statistics',
    example: '2023-12-31T23:59:59.999Z'
  })
  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid date' })
  endDate?: string;
}

export class CardStatisticsResponseDto {
  @ApiProperty({
    description: 'Card ID',
    example: '507f1f77bcf86cd799439011'
  })
  cardId: string;

  @ApiProperty({
    description: 'Statistics period',
    example: {
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-12-31T23:59:59.999Z'
    }
  })
  period: {
    start: Date;
    end: Date;
  };

  @ApiProperty({
    description: 'Total amount spent',
    example: 15750.5
  })
  totalSpent: number;

  @ApiProperty({
    description: 'Total number of transactions',
    example: 156
  })
  totalTransactions: number;

  @ApiProperty({
    description: 'Average transaction amount',
    example: 101.03
  })
  averageTransaction: number;

  @ApiProperty({
    description: 'Current balance',
    example: 2450.75
  })
  currentBalance: number;

  @ApiPropertyOptional({
    description: 'Available credit (for credit cards)',
    example: 2549.25
  })
  availableCredit?: number;

  @ApiPropertyOptional({
    description: 'Credit utilization rate (percentage)',
    example: 49.01
  })
  utilizationRate?: number;

  @ApiProperty({
    description: 'Spending breakdown by category',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        categoryId: { type: 'string' },
        categoryName: { type: 'string' },
        amount: { type: 'number' },
        percentage: { type: 'number' },
        transactionCount: { type: 'number' }
      }
    }
  })
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
    transactionCount: number;
  }>;

  @ApiProperty({
    description: 'Monthly spending pattern',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        month: { type: 'string' },
        year: { type: 'number' },
        amount: { type: 'number' },
        transactionCount: { type: 'number' }
      }
    }
  })
  monthlySpending: Array<{
    month: string;
    year: number;
    amount: number;
    transactionCount: number;
  }>;

  @ApiProperty({
    description: 'Top merchants by spending',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        merchant: { type: 'string' },
        amount: { type: 'number' },
        transactionCount: { type: 'number' },
        lastTransaction: { type: 'string', format: 'date-time' }
      }
    }
  })
  topMerchants: Array<{
    merchant: string;
    amount: number;
    transactionCount: number;
    lastTransaction: Date;
  }>;

  @ApiPropertyOptional({
    description: 'Next payment due date',
    example: '2024-01-15T00:00:00.000Z'
  })
  paymentDue?: Date;

  @ApiPropertyOptional({
    description: 'Minimum payment amount',
    example: 25.0
  })
  minimumPayment?: number;
}

export class PaymentDueSummaryDto {
  @ApiProperty({
    description: 'Cards with upcoming payments',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        cardId: { type: 'string' },
        displayName: { type: 'string' },
        dueDate: { type: 'string', format: 'date-time' },
        minimumPayment: { type: 'number' },
        currentBalance: { type: 'number' },
        isOverdue: { type: 'boolean' },
        daysUntilDue: { type: 'number' }
      }
    }
  })
  cards: Array<{
    cardId: string;
    displayName: string;
    dueDate: Date;
    minimumPayment: number;
    currentBalance: number;
    isOverdue: boolean;
    daysUntilDue: number;
  }>;

  @ApiProperty({
    description: 'Total amount due across all cards',
    example: 875.5
  })
  totalAmountDue: number;

  @ApiProperty({
    description: 'Total minimum payment due',
    example: 125.0
  })
  totalMinimumPayment: number;

  @ApiProperty({
    description: 'Number of overdue cards',
    example: 1
  })
  overdueCount: number;

  @ApiProperty({
    description: 'Total overdue amount',
    example: 50.0
  })
  totalOverdueAmount: number;
}

export class DebtSummaryDto {
  @ApiProperty({
    description: 'Total debt across all cards',
    example: 15750.5
  })
  totalDebt: number;

  @ApiProperty({
    description: 'Total minimum payment due',
    example: 315.5
  })
  totalMinimumPayment: number;

  @ApiProperty({
    description: 'Total available credit',
    example: 24249.5
  })
  totalAvailableCredit: number;

  @ApiProperty({
    description: 'Average utilization rate across all cards',
    example: 38.75
  })
  averageUtilizationRate: number;

  @ApiProperty({
    description: 'Total number of cards',
    example: 4
  })
  cardsCount: number;

  @ApiProperty({
    description: 'Number of overdue cards',
    example: 1
  })
  overdueCount: number;

  @ApiProperty({
    description: 'Total overdue amount',
    example: 250.0
  })
  totalOverdueAmount: number;
}
