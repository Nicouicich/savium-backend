import { Currency } from '@common/constants/transaction-categories';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsDecimal,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { AlertType, BudgetPeriod } from '../schemas/budget.schema';

export class CreateBudgetAlertDto {
  @ApiProperty({
    description: 'Type of alert',
    enum: AlertType,
    example: AlertType.PERCENTAGE
  })
  @IsEnum(AlertType)
  type: AlertType;

  @ApiProperty({
    description: 'Threshold value (percentage 0-100 or amount depending on type)',
    example: 80,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Threshold must have at most 2 decimal places' })
  @Min(0, { message: 'Threshold must be 0 or greater' })
  @Max(100, { message: 'Threshold percentage cannot exceed 100' })
  threshold: number;

  @ApiPropertyOptional({ description: 'Whether this alert is enabled', example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Custom message for the alert', example: 'Budget is 80% spent!', maxLength: 200 })
  @IsOptional()
  @IsString({ message: 'Alert message must be a string' })
  @MaxLength(200, { message: 'Alert message cannot exceed 200 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,!?()&'%]+$/, { message: 'Alert message contains invalid characters' })
  @Transform(({ value }) => value?.trim())
  message?: string;
}

export class CreateCategoryBudgetDto {
  @ApiProperty({
    description: 'Category ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString({ message: 'Category ID must be a string' })
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Category ID must be a valid MongoDB ObjectId' })
  categoryId: string;

  @ApiProperty({
    description: 'Allocated amount for this category',
    example: 500.0,
    minimum: 0.01
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Allocated amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'Allocated amount must be greater than 0' })
  allocatedAmount: number;

  @ApiPropertyOptional({ description: 'Category-specific alerts', type: [CreateBudgetAlertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetAlertDto)
  @ArrayMaxSize(5)
  alerts?: CreateBudgetAlertDto[];

  @ApiPropertyOptional({ description: 'Whether to automatically track transactions for this category', example: true })
  @IsOptional()
  @IsBoolean()
  trackTransactions?: boolean;
}

export class CreateBudgetDto {
  @ApiProperty({
    description: 'Budget name',
    example: 'Monthly Household Budget',
    minLength: 1,
    maxLength: 100
  })
  @IsString({ message: 'Budget name must be a string' })
  @MinLength(1, { message: 'Budget name cannot be empty' })
  @MaxLength(100, { message: 'Budget name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,!?()&']+$/, { message: 'Budget name contains invalid characters' })
  @Transform(({ value }) => value?.trim()?.replace(/\s+/g, ' '))
  name: string;

  @ApiPropertyOptional({
    description: 'Budget description',
    example: 'Budget for regular household transactions including food, utilities, and entertainment',
    maxLength: 500
  })
  @IsOptional()
  @IsString({ message: 'Budget description must be a string' })
  @MaxLength(500, { message: 'Budget description cannot exceed 500 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,!?()&'\n\r]+$/, { message: 'Budget description contains invalid characters' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Account ID this budget belongs to (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString({ message: 'Account ID must be a string' })
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Account ID must be a valid MongoDB ObjectId' })
  accountId: string;

  @ApiPropertyOptional({ description: 'Currency for this budget', enum: Currency, example: Currency.USD })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({
    description: 'Total budget amount',
    example: 2000.0,
    minimum: 0.01,
    maximum: 1000000
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Total amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'Total amount must be greater than 0' })
  @Max(1000000, { message: 'Total amount cannot exceed 1,000,000' })
  totalAmount: number;

  @ApiProperty({
    description: 'Budget period',
    enum: BudgetPeriod,
    example: BudgetPeriod.MONTHLY
  })
  @IsEnum(BudgetPeriod)
  period: BudgetPeriod;

  @ApiProperty({
    description: 'Budget start date',
    example: '2024-01-01T00:00:00.000Z'
  })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({
    description: 'Budget end date',
    example: '2024-01-31T23:59:59.999Z'
  })
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ApiPropertyOptional({ description: 'Category-specific budget allocations', type: [CreateCategoryBudgetDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCategoryBudgetDto)
  @ArrayMaxSize(20)
  categoryBudgets?: CreateCategoryBudgetDto[];

  @ApiPropertyOptional({ description: 'Global budget alerts (apply to total budget)', type: [CreateBudgetAlertDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetAlertDto)
  @ArrayMaxSize(10)
  globalAlerts?: CreateBudgetAlertDto[];

  @ApiPropertyOptional({ description: 'Whether to automatically renew this budget for next period', example: true })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional({
    description: 'User IDs who can view this budget (in addition to account members)',
    type: [String],
    example: ['507f1f77bcf86cd799439012']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  allowedUsers?: string[];

  @ApiPropertyOptional({ description: 'Whether this budget should be saved as a template', example: false })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata and settings', type: 'object' })
  @IsOptional()
  @IsObject()
  metadata?: {
    tags?: string[];
    notes?: string;
    trackingEnabled?: boolean;
    notificationsEnabled?: boolean;
    rolloverUnspent?: boolean;
    source?: string;
  };
}
