import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@common/constants/expense-categories';
import { GoalPriority, GoalType, RecurrenceType } from '../schemas/goal.schema';

export class CreateGoalMilestoneDto {
  @ApiProperty({
    description: 'Milestone title',
    example: 'Save first $1,000',
    minLength: 1,
    maxLength: 100
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({
    description: 'Milestone description',
    example: 'First milestone towards emergency fund',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Target amount for this milestone',
    example: 1000.0,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  targetAmount: number;

  @ApiProperty({
    description: 'Target date for this milestone',
    example: '2024-03-31T23:59:59.999Z'
  })
  @IsDate()
  @Type(() => Date)
  targetDate: Date;

  @ApiPropertyOptional({
    description: 'Order of this milestone',
    example: 1,
    minimum: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  order?: number;
}

export class CreateGoalSettingsDto {
  @ApiPropertyOptional({
    description: 'Send reminder notifications',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  sendReminders?: boolean;

  @ApiPropertyOptional({
    description: 'Days before target date to send reminder',
    example: 7,
    minimum: 1,
    maximum: 365
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  reminderDaysBefore?: number;

  @ApiPropertyOptional({
    description: 'Automatically track progress based on expenses/savings',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  trackAutomatically?: boolean;

  @ApiPropertyOptional({
    description: 'Allow going over target amount',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  allowOverage?: boolean;

  @ApiPropertyOptional({
    description: 'Show this goal in dashboard',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  showInDashboard?: boolean;

  @ApiPropertyOptional({
    description: 'Make this goal private in shared accounts',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    description: 'Category IDs to track for this goal',
    type: [String],
    example: ['507f1f77bcf86cd799439011']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  linkedCategories?: string[];

  @ApiPropertyOptional({
    description: 'Category IDs to exclude from tracking',
    type: [String],
    example: ['507f1f77bcf86cd799439012']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  excludeCategories?: string[];
}

export class CreateGoalDto {
  @ApiProperty({
    description: 'Goal title',
    example: 'Emergency Fund',
    minLength: 1,
    maxLength: 100
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({
    description: 'Goal description',
    example: 'Build an emergency fund to cover 6 months of expenses',
    maxLength: 1000
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description: 'Account ID this goal belongs to',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  accountId: string;

  @ApiProperty({
    description: 'Type of goal',
    enum: GoalType,
    example: GoalType.SAVINGS
  })
  @IsEnum(GoalType)
  type: GoalType;

  @ApiPropertyOptional({
    description: 'Currency for this goal',
    enum: Currency,
    example: Currency.USD
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({
    description: 'Target amount for the goal',
    example: 10000.0,
    minimum: 0,
    maximum: 10000000
  })
  @IsNumber()
  @Min(0)
  @Max(10000000)
  targetAmount: number;

  @ApiPropertyOptional({
    description: 'Current progress amount',
    example: 2500.0,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @ApiProperty({
    description: 'Target date for goal completion',
    example: '2024-12-31T23:59:59.999Z'
  })
  @IsDate()
  @Type(() => Date)
  targetDate: Date;

  @ApiPropertyOptional({
    description: 'Goal start date (defaults to creation date)',
    example: '2024-01-01T00:00:00.000Z'
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Goal priority level',
    enum: GoalPriority,
    example: GoalPriority.HIGH
  })
  @IsOptional()
  @IsEnum(GoalPriority)
  priority?: GoalPriority;

  @ApiPropertyOptional({
    description: 'Recurrence type for recurring contributions',
    enum: RecurrenceType,
    example: RecurrenceType.MONTHLY
  })
  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrence?: RecurrenceType;

  @ApiPropertyOptional({
    description: 'Amount to contribute per recurrence period',
    example: 500.0,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  recurringAmount?: number;

  @ApiPropertyOptional({
    description: 'Goal milestones',
    type: [CreateGoalMilestoneDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGoalMilestoneDto)
  @ArrayMaxSize(10)
  milestones?: CreateGoalMilestoneDto[];

  @ApiPropertyOptional({
    description: 'Goal settings and preferences',
    type: CreateGoalSettingsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateGoalSettingsDto)
  settings?: CreateGoalSettingsDto;

  @ApiPropertyOptional({
    description: 'User IDs who participate in this goal',
    type: [String],
    example: ['507f1f77bcf86cd799439012']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  participants?: string[];

  @ApiPropertyOptional({
    description: 'Linked budget ID (for budget-related goals)',
    example: '507f1f77bcf86cd799439013'
  })
  @IsOptional()
  @IsString()
  linkedBudgetId?: string;

  @ApiPropertyOptional({
    description: 'Whether this goal should be saved as a template',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata and settings',
    type: 'object'
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    tags?: string[];
    notes?: string;
    initialAmount?: number;
  };
}
