import { IsEnum, IsOptional, IsBoolean, IsNumber, IsString, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoupleFinancialModel, CoupleExpenseType } from '@common/constants/couple-types';

export class UpdateCoupleContributionDto {
  @ApiProperty({
    description: 'Partner 1 contribution percentage (0-100)',
    minimum: 0,
    maximum: 100,
    example: 60
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Partner 1 contribution must be a valid percentage' })
  @Min(0, { message: 'Partner 1 contribution cannot be negative' })
  @Max(100, { message: 'Partner 1 contribution cannot exceed 100%' })
  partner1ContributionPercentage: number;

  @ApiProperty({
    description: 'Partner 2 contribution percentage (0-100)',
    minimum: 0,
    maximum: 100,
    example: 40
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Partner 2 contribution must be a valid percentage' })
  @Min(0, { message: 'Partner 2 contribution cannot be negative' })
  @Max(100, { message: 'Partner 2 contribution cannot exceed 100%' })
  partner2ContributionPercentage: number;

  @ApiPropertyOptional({
    description: 'Partner 1 monthly income (optional, for reference)',
    minimum: 0,
    example: 5000
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Partner 1 income must be a valid number' })
  @Min(0, { message: 'Partner 1 income cannot be negative' })
  partner1MonthlyIncome?: number;

  @ApiPropertyOptional({
    description: 'Partner 2 monthly income (optional, for reference)',
    minimum: 0,
    example: 3500
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Partner 2 income must be a valid number' })
  @Min(0, { message: 'Partner 2 income cannot be negative' })
  partner2MonthlyIncome?: number;

  @ApiPropertyOptional({
    description: 'Automatically calculate contribution percentages from income',
    default: false
  })
  @IsOptional()
  @IsBoolean({ message: 'Auto calculate flag must be boolean' })
  autoCalculateFromIncome?: boolean;

  @ApiPropertyOptional({
    description: 'Reason for updating contribution settings',
    example: 'Salary adjustment after promotion'
  })
  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  reason?: string;
}

export class CoupleNotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Notify when partner adds an expense',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  expenseAdded?: boolean;

  @ApiPropertyOptional({
    description: 'Notify about comments and reactions on expenses',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  commentsAndReactions?: boolean;

  @ApiPropertyOptional({
    description: 'Notify when gift expenses are revealed',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  giftRevealed?: boolean;

  @ApiPropertyOptional({
    description: 'Notify about cross-reminders from partner',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  reminders?: boolean;

  @ApiPropertyOptional({
    description: 'Notify about budget alerts and warnings',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  budgetAlerts?: boolean;
}

export class UpdateCoupleSettingsDto {
  @ApiPropertyOptional({
    description: 'Financial model for the couple account',
    enum: CoupleFinancialModel,
    example: CoupleFinancialModel.FIFTY_FIFTY
  })
  @IsOptional()
  @IsEnum(CoupleFinancialModel, { message: 'Invalid financial model' })
  financialModel?: CoupleFinancialModel;

  @ApiPropertyOptional({
    description: 'Default expense type for new expenses',
    enum: CoupleExpenseType,
    example: CoupleExpenseType.SHARED
  })
  @IsOptional()
  @IsEnum(CoupleExpenseType, { message: 'Invalid default expense type' })
  defaultExpenseType?: CoupleExpenseType;

  @ApiPropertyOptional({
    description: 'Contribution settings for proportional income model',
    type: UpdateCoupleContributionDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCoupleContributionDto)
  contributionSettings?: UpdateCoupleContributionDto;

  @ApiPropertyOptional({
    description: 'Allow comments on expenses',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @ApiPropertyOptional({
    description: 'Allow reactions on expenses',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  allowReactions?: boolean;

  @ApiPropertyOptional({
    description: 'Show contribution statistics in dashboard',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  showContributionStats?: boolean;

  @ApiPropertyOptional({
    description: 'Enable cross-reminders between partners',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  enableCrossReminders?: boolean;

  @ApiPropertyOptional({
    description: 'Enable gift mode for expenses',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  giftModeEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable shared goals functionality',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  sharedGoalsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Notification preferences',
    type: CoupleNotificationPreferencesDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoupleNotificationPreferencesDto)
  notifications?: CoupleNotificationPreferencesDto;
}

export class CoupleSettingsResponseDto {
  @ApiProperty({ description: 'Account ID' })
  accountId: string;

  @ApiProperty({
    description: 'Financial model',
    enum: CoupleFinancialModel
  })
  financialModel: CoupleFinancialModel;

  @ApiProperty({
    description: 'Default expense type',
    enum: CoupleExpenseType
  })
  defaultExpenseType: CoupleExpenseType;

  @ApiPropertyOptional({ description: 'Contribution settings' })
  contributionSettings?: {
    partner1UserId: string;
    partner2UserId: string;
    partner1ContributionPercentage: number;
    partner2ContributionPercentage: number;
    partner1MonthlyIncome?: number;
    partner2MonthlyIncome?: number;
    autoCalculateFromIncome: boolean;
    lastUpdatedAt: Date;
    updatedBy: string;
  };

  @ApiProperty({ description: 'Comments allowed' })
  allowComments: boolean;

  @ApiProperty({ description: 'Reactions allowed' })
  allowReactions: boolean;

  @ApiProperty({ description: 'Show contribution stats' })
  showContributionStats: boolean;

  @ApiProperty({ description: 'Cross-reminders enabled' })
  enableCrossReminders: boolean;

  @ApiProperty({ description: 'Gift mode enabled' })
  giftModeEnabled: boolean;

  @ApiProperty({ description: 'Shared goals enabled' })
  sharedGoalsEnabled: boolean;

  @ApiProperty({ description: 'Notification preferences' })
  notifications: {
    expenseAdded: boolean;
    commentsAndReactions: boolean;
    giftRevealed: boolean;
    reminders: boolean;
    budgetAlerts: boolean;
  };

  @ApiProperty({ description: 'Premium feature: Shared goals' })
  hasSharedGoals: boolean;

  @ApiProperty({ description: 'Premium feature: Detailed comparisons' })
  hasDetailedComparisons: boolean;

  @ApiProperty({ description: 'Premium feature: Joint evolution panel' })
  hasJointEvolutionPanel: boolean;

  @ApiProperty({ description: 'Premium feature: Downloadable reports' })
  hasDownloadableReports: boolean;

  @ApiProperty({ description: 'Premium feature: Advanced analytics' })
  hasAdvancedAnalytics: boolean;

  @ApiProperty({ description: 'Premium feature: Unlimited comments' })
  hasUnlimitedComments: boolean;

  @ApiProperty({ description: 'Premium feature: Custom categories' })
  hasCustomCategories: boolean;

  @ApiPropertyOptional({ description: 'User who accepted invitation' })
  invitationAcceptedBy?: string;

  @ApiPropertyOptional({ description: 'When invitation was accepted' })
  invitationAcceptedAt?: Date;

  @ApiProperty({ description: 'Both partners have accepted' })
  bothPartnersAccepted: boolean;

  @ApiProperty({ description: 'Settings creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Settings last update date' })
  updatedAt: Date;
}

export class AcceptCoupleInvitationDto {
  @ApiPropertyOptional({
    description: 'Initial financial model preference',
    enum: CoupleFinancialModel,
    example: CoupleFinancialModel.FIFTY_FIFTY
  })
  @IsOptional()
  @IsEnum(CoupleFinancialModel)
  preferredFinancialModel?: CoupleFinancialModel;

  @ApiPropertyOptional({
    description: 'Initial contribution settings for proportional model',
    type: UpdateCoupleContributionDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCoupleContributionDto)
  initialContributionSettings?: UpdateCoupleContributionDto;
}

export class CoupleStatsDto {
  @ApiProperty({ description: 'Total shared expenses this month' })
  totalSharedExpensesThisMonth: number;

  @ApiProperty({ description: 'Total personal expenses for user this month' })
  totalPersonalExpensesThisMonth: number;

  @ApiProperty({ description: 'Partner total personal expenses this month' })
  partnerPersonalExpensesThisMonth: number;

  @ApiProperty({ description: 'User contribution percentage this month' })
  userContributionPercentage: number;

  @ApiProperty({ description: 'Partner contribution percentage this month' })
  partnerContributionPercentage: number;

  @ApiProperty({ description: 'User total contribution amount' })
  userTotalContribution: number;

  @ApiProperty({ description: 'Partner total contribution amount' })
  partnerTotalContribution: number;

  @ApiProperty({ description: 'Outstanding balance (positive = user owes, negative = partner owes)' })
  outstandingBalance: number;

  @ApiProperty({ description: 'Top shared expense categories' })
  topSharedCategories: Array<{
    categoryId: string;
    categoryName: string;
    totalAmount: number;
    expenseCount: number;
  }>;

  @ApiProperty({ description: 'Monthly trend comparison' })
  monthlyTrend: Array<{
    month: string;
    userContribution: number;
    partnerContribution: number;
    sharedExpenses: number;
  }>;

  @ApiPropertyOptional({ description: 'Gift expenses count (if gift mode enabled)' })
  hiddenGiftsCount?: number;
}

export class ExpenseContextParseDto {
  @ApiProperty({
    description: 'Original expense description',
    example: '$50 groceries @pareja'
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Parsed context (couple, personal, family, business)',
    example: 'couple'
  })
  context?: string;

  @ApiPropertyOptional({
    description: 'Clean description without context keyword',
    example: '$50 groceries'
  })
  cleanDescription?: string;

  @ApiPropertyOptional({
    description: 'Suggested account ID based on context',
    example: '507f1f77bcf86cd799439011'
  })
  suggestedAccountId?: string;

  @ApiPropertyOptional({
    description: 'Expense type for couple context',
    enum: CoupleExpenseType,
    example: CoupleExpenseType.SHARED
  })
  expenseType?: CoupleExpenseType;
}
