import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@common/constants/expense-categories';
import { GoalPriority, GoalStatus, GoalType, RecurrenceType } from '../schemas/goal.schema';

export class GoalMilestoneResponseDto {
  @ApiProperty({ description: 'Milestone title' })
  title: string;

  @ApiPropertyOptional({ description: 'Milestone description' })
  description?: string;

  @ApiProperty({ description: 'Target amount for this milestone' })
  targetAmount: number;

  @ApiProperty({ description: 'Current progress amount' })
  currentAmount: number;

  @ApiProperty({ description: 'Target date for this milestone' })
  targetDate: Date;

  @ApiProperty({ description: 'Whether milestone is completed' })
  isCompleted: boolean;

  @ApiPropertyOptional({ description: 'Completion date' })
  completedAt?: Date;

  @ApiProperty({ description: 'Milestone order' })
  order: number;

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progressPercentage: number;

  @ApiProperty({ description: 'Days remaining until target date' })
  daysRemaining: number;

  @ApiProperty({ description: 'Whether milestone is overdue' })
  isOverdue: boolean;
}

export class GoalSettingsResponseDto {
  @ApiProperty({ description: 'Send reminder notifications' })
  sendReminders: boolean;

  @ApiProperty({ description: 'Days before target date to send reminder' })
  reminderDaysBefore: number;

  @ApiProperty({ description: 'Automatically track progress' })
  trackAutomatically: boolean;

  @ApiProperty({ description: 'Allow going over target amount' })
  allowOverage: boolean;

  @ApiProperty({ description: 'Show this goal in dashboard' })
  showInDashboard: boolean;

  @ApiProperty({ description: 'Goal is private in shared accounts' })
  isPrivate: boolean;

  @ApiProperty({ description: 'Linked category IDs', type: [String] })
  linkedCategories: string[];

  @ApiProperty({ description: 'Excluded category IDs', type: [String] })
  excludeCategories: string[];
}

export class GoalProgressDto {
  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progressPercentage: number;

  @ApiProperty({ description: 'Days elapsed since goal start' })
  daysElapsed: number;

  @ApiProperty({ description: 'Total days from start to target date' })
  totalDays: number;

  @ApiProperty({ description: 'Days remaining until target date' })
  daysRemaining: number;

  @ApiProperty({ description: 'Average progress per day' })
  averageProgressPerDay: number;

  @ApiProperty({ description: 'Required daily progress to meet target' })
  requiredDailyProgress: number;

  @ApiProperty({ description: 'Whether goal is on track to completion' })
  onTrack: boolean;

  @ApiProperty({
    description: 'Estimated completion date based on current progress'
  })
  estimatedCompletion?: Date;

  @ApiProperty({ description: 'Whether goal is overdue' })
  isOverdue: boolean;

  @ApiProperty({ description: 'Goal health status' })
  healthStatus: 'excellent' | 'good' | 'warning' | 'danger';

  @ApiProperty({ description: 'Next milestone information' })
  nextMilestone?: {
    title: string;
    targetAmount: number;
    remainingAmount: number;
    targetDate: Date;
    daysRemaining: number;
  };
}

export class GoalStatisticsDto {
  @ApiProperty({ description: 'Number of completed milestones' })
  completedMilestones: number;

  @ApiProperty({ description: 'Total number of milestones' })
  totalMilestones: number;

  @ApiProperty({ description: 'Best day of progress' })
  bestProgressDay?: {
    date: Date;
    amount: number;
  };

  @ApiProperty({ description: 'Longest streak of progress (days)' })
  longestStreak: number;

  @ApiProperty({ description: 'Current streak of progress (days)' })
  currentStreak: number;

  @ApiProperty({ description: 'Average monthly progress' })
  averageMonthlyProgress: number;

  @ApiProperty({ description: 'Time to complete at current rate (days)' })
  timeToCompletionDays?: number;
}

export class GoalResponseDto {
  @ApiProperty({ description: 'Goal ID' })
  id: string;

  @ApiProperty({ description: 'Goal title' })
  title: string;

  @ApiPropertyOptional({ description: 'Goal description' })
  description?: string;

  @ApiProperty({ description: 'Account ID' })
  accountId: string;

  @ApiProperty({ description: 'Account name' })
  accountName: string;

  @ApiProperty({ description: 'User who created the goal' })
  createdBy: {
    id: string;
    name: string;
    email: string;
  };

  @ApiProperty({ description: 'Goal type' })
  type: GoalType;

  @ApiProperty({ description: 'Currency' })
  currency: Currency;

  @ApiProperty({ description: 'Target amount' })
  targetAmount: number;

  @ApiProperty({ description: 'Current progress amount' })
  currentAmount: number;

  @ApiProperty({ description: 'Remaining amount to reach target' })
  remainingAmount: number;

  @ApiProperty({ description: 'Target date for completion' })
  targetDate: Date;

  @ApiPropertyOptional({ description: 'Goal start date' })
  startDate?: Date;

  @ApiProperty({ description: 'Goal status' })
  status: GoalStatus;

  @ApiProperty({ description: 'Goal priority' })
  priority: GoalPriority;

  @ApiProperty({ description: 'Recurrence type' })
  recurrence: RecurrenceType;

  @ApiPropertyOptional({ description: 'Recurring contribution amount' })
  recurringAmount?: number;

  @ApiProperty({ description: 'Goal settings' })
  settings: GoalSettingsResponseDto;

  @ApiProperty({ description: 'Participating users' })
  participants: Array<{
    id: string;
    name: string;
    email: string;
  }>;

  @ApiPropertyOptional({ description: 'Linked budget ID' })
  linkedBudgetId?: string;

  @ApiPropertyOptional({ description: 'Linked budget name' })
  linkedBudgetName?: string;

  @ApiProperty({ description: 'Whether this is a template' })
  isTemplate: boolean;

  @ApiProperty({ description: 'Goal metadata' })
  metadata: {
    source?: string;
    tags?: string[];
    notes?: string;
    lastCalculated?: Date;
    initialAmount?: number;
    averageProgress?: number;
    estimatedCompletion?: Date;
  };

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Goal milestones',
    type: [GoalMilestoneResponseDto]
  })
  milestones?: GoalMilestoneResponseDto[];

  @ApiPropertyOptional({ description: 'Goal progress information' })
  progress?: GoalProgressDto;

  @ApiPropertyOptional({ description: 'Goal statistics' })
  statistics?: GoalStatisticsDto;
}

export class GoalSummaryDto {
  @ApiProperty({ description: 'Total active goals' })
  totalActiveGoals: number;

  @ApiProperty({ description: 'Total completed goals' })
  totalCompletedGoals: number;

  @ApiProperty({ description: 'Total target amount across all goals' })
  totalTargetAmount: number;

  @ApiProperty({ description: 'Total progress amount across all goals' })
  totalProgressAmount: number;

  @ApiProperty({ description: 'Overall progress percentage' })
  overallProgress: number;

  @ApiProperty({ description: 'Number of overdue goals' })
  overdueGoalsCount: number;

  @ApiProperty({ description: 'Number of goals near completion (>80%)' })
  nearCompletionCount: number;

  @ApiProperty({ description: 'Goals by status' })
  goalsByStatus: Record<GoalStatus, number>;

  @ApiProperty({ description: 'Goals by type' })
  goalsByType: Record<GoalType, number>;

  @ApiProperty({ description: 'Goals by priority' })
  goalsByPriority: Record<GoalPriority, number>;

  @ApiProperty({
    description: 'Most active goal (highest progress this month)'
  })
  mostActiveGoal?: {
    id: string;
    title: string;
    progressThisMonth: number;
  };

  @ApiProperty({ description: 'Next goal to complete' })
  nextToComplete?: {
    id: string;
    title: string;
    remainingAmount: number;
    targetDate: Date;
    daysRemaining: number;
  };
}
