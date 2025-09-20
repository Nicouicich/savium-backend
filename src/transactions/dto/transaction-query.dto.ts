import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, PaymentMethod } from '@common/constants/transaction-categories';

export class TransactionQueryDto {
  @ApiPropertyOptional({ description: 'Profile ID to filter transactions', example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiPropertyOptional({ description: 'Category ID to filter transactions', example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'User ID to filter transactions', example: '507f1f77bcf86cd799439013' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Start date for date range filter', example: '2024-01-01' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for date range filter', example: '2024-12-31' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Minimum amount filter', example: 10.0, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum amount filter', example: 1000.0, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'Payment method filter', enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Currency filter', enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ description: 'Vendor name filter (partial match)', example: 'Starbucks' })
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional({ description: 'Search term for description, vendor, or notes', example: 'coffee' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by recurring transactions', example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Filter by shared transactions', example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isSharedTransaction?: boolean;

  @ApiPropertyOptional({ description: 'Filter by private transactions', example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isPrivate?: boolean;

  @ApiPropertyOptional({ description: 'Filter by flagged transactions', example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isFlagged?: boolean;

  @ApiPropertyOptional({ description: 'Filter by transactions needing review', example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  needsReview?: boolean;

  @ApiPropertyOptional({ description: 'Filter by transaction status', enum: ['active', 'pending_approval', 'approved', 'rejected'] })
  @IsOptional()
  @IsString()
  status?: 'active' | 'pending_approval' | 'approved' | 'rejected';

  @ApiPropertyOptional({ description: 'Tags to filter by', example: 'business,travel' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'Page number for pagination', example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Number of items per page', example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['date', 'amount', 'description', 'vendor', 'createdAt'], default: 'date' })
  @IsOptional()
  @IsString()
  sortBy?: 'date' | 'amount' | 'description' | 'vendor' | 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
