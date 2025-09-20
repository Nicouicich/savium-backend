import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { GoalPriority, GoalStatus, GoalType, RecurrenceType } from '../schemas/goal.schema';

export class GoalQueryDto {
  @ApiPropertyOptional({
    description: 'Profile ID to filter goals',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiPropertyOptional({
    description: 'Goal type filter',
    enum: GoalType,
    example: GoalType.SAVINGS
  })
  @IsOptional()
  @IsEnum(GoalType)
  type?: GoalType;

  @ApiPropertyOptional({
    description: 'Goal status filter',
    enum: GoalStatus,
    example: GoalStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @ApiPropertyOptional({
    description: 'Goal priority filter',
    enum: GoalPriority,
    example: GoalPriority.HIGH
  })
  @IsOptional()
  @IsEnum(GoalPriority)
  priority?: GoalPriority;

  @ApiPropertyOptional({
    description: 'Recurrence type filter',
    enum: RecurrenceType,
    example: RecurrenceType.MONTHLY
  })
  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrence?: RecurrenceType;

  @ApiPropertyOptional({
    description: 'Target date from filter (ISO string)',
    example: '2024-01-01'
  })
  @IsOptional()
  @IsDateString()
  targetDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Target date to filter (ISO string)',
    example: '2024-12-31'
  })
  @IsOptional()
  @IsDateString()
  targetDateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by template goals only',
    example: false
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isTemplate?: boolean;

  @ApiPropertyOptional({
    description: 'Include user as participant',
    example: true
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeParticipated?: boolean;

  @ApiPropertyOptional({
    description: 'Show only overdue goals',
    example: false
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdueOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Show only near-completion goals (>80% progress)',
    example: false
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  nearCompletionOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Search in goal title and description',
    example: 'emergency fund'
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by tags (comma-separated)',
    example: 'savings,important'
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    minimum: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'targetDate'
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc']
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Include progress and statistics',
    example: true
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeProgress?: boolean;

  @ApiPropertyOptional({
    description: 'Include milestone information',
    example: true
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeMilestones?: boolean;
}
