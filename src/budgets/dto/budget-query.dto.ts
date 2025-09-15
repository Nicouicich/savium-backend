import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetPeriod, BudgetStatus } from '../schemas/budget.schema';
import { IsMongoObjectId } from '@common/decorators/validation.decorator';

export class BudgetQueryDto {
  @ApiPropertyOptional({
    description: 'Account ID to filter budgets (must be a valid MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsMongoObjectId({ message: 'accountId must be a valid MongoDB ObjectId (24-character hexadecimal string)' })
  accountId?: string;

  @ApiPropertyOptional({ description: 'Budget status filter', enum: BudgetStatus, example: BudgetStatus.ACTIVE })
  @IsOptional()
  @IsEnum(BudgetStatus)
  status?: BudgetStatus;

  @ApiPropertyOptional({ description: 'Budget period filter', enum: BudgetPeriod, example: BudgetPeriod.MONTHLY })
  @IsOptional()
  @IsEnum(BudgetPeriod)
  period?: BudgetPeriod;

  @ApiPropertyOptional({ description: 'Start date filter (ISO string)', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO string)', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by template budgets only', example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isTemplate?: boolean;

  @ApiPropertyOptional({ description: 'Search in budget name and description', example: 'monthly household' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by tags (comma-separated)', example: 'household,essential' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'Page number', example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort field', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort order', example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Include budget progress and statistics', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeProgress?: boolean;

  @ApiPropertyOptional({ description: 'Include category breakdown', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeCategoryBreakdown?: boolean;
}
