import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
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
  ValidateNested,
  IsPositive,
  IsDecimal
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, PaymentMethod } from '@common/constants/expense-categories';

export class CreateRecurringPatternDto {
  @ApiProperty({
    description: 'Frequency of recurrence',
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    example: 'monthly'
  })
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'])
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';

  @ApiProperty({
    description: 'Interval between occurrences',
    example: 1,
    minimum: 1,
    maximum: 100
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  interval: number;

  @ApiPropertyOptional({ description: 'End date for recurring expenses', example: '2024-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Next occurrence date (calculated automatically)', example: '2024-12-01T00:00:00.000Z' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  nextOccurrence?: Date;
}

export class CreateSplitDto {
  @ApiProperty({
    description: 'User ID to split with (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString({ message: 'User ID must be a string' })
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'User ID must be a valid MongoDB ObjectId' })
  userId: string;

  @ApiProperty({
    description: 'Amount for this user',
    example: 25.5,
    minimum: 0.01
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Max(999999.99, { message: 'Amount cannot exceed 999,999.99' })
  amount: number;

  @ApiPropertyOptional({ description: 'Percentage of total amount', example: 50, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ApiPropertyOptional({ description: 'Whether this user has paid their share', example: false })
  @IsOptional()
  @IsBoolean()
  paid?: boolean;
}

export class CreateSplitDetailsDto {
  @ApiProperty({
    description: 'Total amount to be split',
    example: 100.0,
    minimum: 0.01
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Total amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'Total amount must be greater than 0' })
  @Max(999999.99, { message: 'Total amount cannot exceed 999,999.99' })
  totalAmount: number;

  @ApiProperty({
    description: 'How to split the expense',
    enum: ['equal', 'percentage', 'amount'],
    example: 'equal'
  })
  @IsEnum(['equal', 'percentage', 'amount'])
  splitMethod: 'equal' | 'percentage' | 'amount';

  @ApiProperty({
    description: 'Split details for each user',
    type: [CreateSplitDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSplitDto)
  @ArrayMaxSize(20)
  splits: CreateSplitDto[];
}

export class CreateLocationDto {
  @ApiProperty({ description: 'Latitude', example: 40.7128 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ description: 'Longitude', example: -74.006 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({ description: 'Address', example: 'New York, NY, USA' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class CreateExpenseDto {
  @ApiProperty({
    description: 'Expense description',
    example: 'Lunch at Italian restaurant',
    minLength: 1,
    maxLength: 200
  })
  @IsString({ message: 'Description must be a string' })
  @MinLength(1, { message: 'Description cannot be empty' })
  @MaxLength(200, { message: 'Description cannot exceed 200 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,!?()&]+$/, { message: 'Description contains invalid characters' })
  @Transform(({ value }) => value?.trim())
  description: string;

  @ApiProperty({
    description: 'Expense amount',
    example: 45.5,
    minimum: 0.01,
    maximum: 999999.99
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Max(999999.99, { message: 'Amount cannot exceed 999,999.99' })
  amount: number;

  @ApiPropertyOptional({ description: 'Currency code', enum: Currency, example: Currency.USD })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({
    description: 'Expense date (ISO 8601 format)',
    example: '2024-01-15T12:30:00.000Z'
  })
  @IsDateString({}, { message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' })
  @Type(() => Date)
  date: Date;

  @ApiProperty({
    description: 'Category ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString({ message: 'Category ID must be a string' })
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Category ID must be a valid MongoDB ObjectId' })
  categoryId: string;

  @ApiPropertyOptional({ description: 'Subcategory name', example: 'restaurant', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subcategoryName?: string;

  @ApiProperty({
    description: 'Account ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString({ message: 'Account ID must be a string' })
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Account ID must be a valid MongoDB ObjectId' })
  accountId: string;

  @ApiPropertyOptional({ description: 'Payment method', enum: PaymentMethod, example: PaymentMethod.CREDIT_CARD })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Vendor or merchant name', example: "Marco's Italian Kitchen", maxLength: 150 })
  @IsOptional()
  @IsString({ message: 'Vendor must be a string' })
  @MaxLength(150, { message: 'Vendor name cannot exceed 150 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,!?()&']+$/, { message: 'Vendor name contains invalid characters' })
  @Transform(({ value }) => value?.trim())
  vendor?: string;

  @ApiPropertyOptional({ description: 'Additional notes', example: 'Business lunch with client', maxLength: 1000 })
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(1000, { message: 'Notes cannot exceed 1000 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,!?()&'\n\r]+$/, { message: 'Notes contain invalid characters' })
  @Transform(({ value }) => value?.trim())
  notes?: string;

  @ApiPropertyOptional({ description: 'Whether this is a recurring expense', example: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Recurring pattern configuration', type: CreateRecurringPatternDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRecurringPatternDto)
  recurringPattern?: CreateRecurringPatternDto;

  @ApiPropertyOptional({ description: 'Whether this is a shared expense', example: false })
  @IsOptional()
  @IsBoolean()
  isSharedExpense?: boolean;

  @ApiPropertyOptional({
    description: 'User IDs to share the expense with (MongoDB ObjectIds)',
    type: [String],
    example: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013']
  })
  @IsOptional()
  @IsArray({ message: 'SharedWith must be an array' })
  @IsString({ each: true, message: 'Each user ID must be a string' })
  @Matches(/^[0-9a-fA-F]{24}$/, { each: true, message: 'Each user ID must be a valid MongoDB ObjectId' })
  @ArrayMaxSize(20, { message: 'Cannot share with more than 20 users' })
  sharedWith?: string[];

  @ApiPropertyOptional({ description: 'Split configuration for shared expenses', type: CreateSplitDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSplitDetailsDto)
  splitDetails?: CreateSplitDetailsDto;

  @ApiPropertyOptional({ description: 'Whether this expense is private', example: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ description: 'Location where expense occurred', type: CreateLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateLocationDto)
  location?: CreateLocationDto;

  @ApiPropertyOptional({ description: 'Tags for expense organization', type: [String], example: ['business', 'client_meeting'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  tags?: string[];

  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
