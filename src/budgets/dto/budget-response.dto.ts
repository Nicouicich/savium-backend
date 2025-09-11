import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Currency} from '@common/constants/expense-categories';
import {AlertType, BudgetPeriod, BudgetStatus} from '../schemas/budget.schema';

export class BudgetAlertResponseDto {
  @ApiProperty({description: 'Alert type'})
  type: AlertType;

  @ApiProperty({description: 'Alert threshold'})
  threshold: number;

  @ApiProperty({description: 'Whether alert is enabled'})
  enabled: boolean;

  @ApiProperty({description: 'Whether alert has been triggered'})
  triggered: boolean;

  @ApiPropertyOptional({description: 'When alert was triggered'})
  triggeredAt?: Date;

  @ApiPropertyOptional({description: 'Alert message'})
  message?: string;
}

export class CategoryBudgetResponseDto {
  @ApiProperty({description: 'Category ID'})
  categoryId: string;

  @ApiProperty({description: 'Category name'})
  categoryName: string;

  @ApiProperty({description: 'Category icon'})
  categoryIcon: string;

  @ApiProperty({description: 'Category color'})
  categoryColor: string;

  @ApiProperty({description: 'Allocated amount'})
  allocatedAmount: number;

  @ApiProperty({description: 'Amount spent'})
  spentAmount: number;

  @ApiProperty({description: 'Remaining amount'})
  remainingAmount: number;

  @ApiProperty({description: 'Progress percentage (0-100)'})
  progressPercentage: number;

  @ApiProperty({description: 'Whether budget is over allocated amount'})
  isOverBudget: boolean;

  @ApiProperty({
    description: 'Category-specific alerts',
    type: [BudgetAlertResponseDto]
  })
  alerts: BudgetAlertResponseDto[];

  @ApiProperty({description: 'Whether expense tracking is enabled'})
  trackExpenses: boolean;
}

export class BudgetProgressDto {
  @ApiProperty({description: 'Total progress percentage (0-100)'})
  overallProgress: number;

  @ApiProperty({description: 'Days elapsed in budget period'})
  daysElapsed: number;

  @ApiProperty({description: 'Total days in budget period'})
  totalDays: number;

  @ApiProperty({
    description: 'Expected spending at this point (based on time elapsed)'
  })
  expectedSpending: number;

  @ApiProperty({description: 'Actual vs expected spending difference'})
  spendingVariance: number;

  @ApiProperty({description: 'Whether spending is on track'})
  onTrack: boolean;

  @ApiProperty({
    description: 'Projected total spending if current rate continues'
  })
  projectedSpending: number;

  @ApiProperty({description: 'Average daily spending'})
  averageDailySpending: number;

  @ApiProperty({description: 'Budget health status'})
  healthStatus: 'excellent' | 'good' | 'warning' | 'danger';
}

export class BudgetStatisticsDto {
  @ApiProperty({description: 'Number of transactions'})
  transactionCount: number;

  @ApiProperty({description: 'Number of active categories'})
  activeCategoriesCount: number;

  @ApiProperty({description: 'Most spent category'})
  topCategory?: {
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
  };

  @ApiProperty({description: 'Largest single expense'})
  largestExpense?: {
    id: string;
    description: string;
    amount: number;
    date: Date;
    categoryName: string;
  };

  @ApiProperty({description: 'Most active day (highest spending)'})
  mostActiveDay?: {
    date: Date;
    amount: number;
    transactionCount: number;
  };
}

export class BudgetResponseDto {
  @ApiProperty({description: 'Budget ID'})
  id: string;

  @ApiProperty({description: 'Budget name'})
  name: string;

  @ApiPropertyOptional({description: 'Budget description'})
  description?: string;

  @ApiProperty({description: 'Account ID'})
  accountId: string;

  @ApiProperty({description: 'Account name'})
  accountName: string;

  @ApiProperty({description: 'User who created the budget'})
  createdBy: {
    id: string;
    name: string;
    email: string;
  };

  @ApiProperty({description: 'Currency'})
  currency: Currency;

  @ApiProperty({description: 'Total budget amount'})
  totalAmount: number;

  @ApiProperty({description: 'Amount spent'})
  spentAmount: number;

  @ApiProperty({description: 'Remaining amount'})
  remainingAmount: number;

  @ApiProperty({description: 'Budget period'})
  period: BudgetPeriod;

  @ApiProperty({description: 'Budget start date'})
  startDate: Date;

  @ApiProperty({description: 'Budget end date'})
  endDate: Date;

  @ApiProperty({description: 'Budget status'})
  status: BudgetStatus;

  @ApiProperty({description: 'Whether budget auto-renews'})
  autoRenew: boolean;

  @ApiPropertyOptional({description: 'ID of budget this was renewed from'})
  renewedFromId?: string;

  @ApiProperty({description: 'Whether this is a template'})
  isTemplate: boolean;

  @ApiProperty({description: 'Global alerts', type: [BudgetAlertResponseDto]})
  globalAlerts: BudgetAlertResponseDto[];

  @ApiProperty({description: 'Allowed users'})
  allowedUsers: Array<{
    id: string;
    name: string;
    email: string;
  }>;

  @ApiProperty({description: 'Metadata'})
  metadata: {
    source?: string;
    tags?: string[];
    notes?: string;
    lastRecalculated?: Date;
    trackingEnabled?: boolean;
    notificationsEnabled?: boolean;
    rolloverUnspent?: boolean;
  };

  @ApiProperty({description: 'Created at'})
  createdAt: Date;

  @ApiProperty({description: 'Updated at'})
  updatedAt: Date;

  @ApiPropertyOptional({description: 'Category budgets', type: [CategoryBudgetResponseDto]})
  categoryBudgets?: CategoryBudgetResponseDto[];

  @ApiPropertyOptional({description: 'Budget progress information'})
  progress?: BudgetProgressDto;

  @ApiPropertyOptional({description: 'Budget statistics'})
  statistics?: BudgetStatisticsDto;
}

export class BudgetSummaryDto {
  @ApiProperty({description: 'Total active budgets'})
  totalActiveBudgets: number;

  @ApiProperty({description: 'Total budget amount across all active budgets'})
  totalBudgetAmount: number;

  @ApiProperty({description: 'Total spent across all active budgets'})
  totalSpentAmount: number;

  @ApiProperty({description: 'Total remaining across all active budgets'})
  totalRemainingAmount: number;

  @ApiProperty({description: 'Overall progress percentage'})
  overallProgress: number;

  @ApiProperty({description: 'Number of budgets over limit'})
  overBudgetCount: number;

  @ApiProperty({description: 'Number of active alerts'})
  activeAlertsCount: number;

  @ApiProperty({description: 'Budgets by status'})
  budgetsByStatus: Record<BudgetStatus, number>;

  @ApiProperty({description: 'Budgets by period'})
  budgetsByPeriod: Record<BudgetPeriod, number>;
}
