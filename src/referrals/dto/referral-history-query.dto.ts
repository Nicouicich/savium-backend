import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ReferralHistoryStatus {
  ALL = 'all',
  PENDING = 'pending',
  COMPLETED = 'completed'
}

export enum ReferralHistorySortBy {
  CREATED_AT = 'createdAt',
  COMPLETED_AT = 'completedAt',
  NAME = 'name',
  EMAIL = 'email',
  REWARD_AMOUNT = 'rewardAmount'
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

export class ReferralHistoryQueryDto {
  @ApiProperty({
    description: 'Page number',
    minimum: 1,
    default: 1,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by referral status',
    enum: ReferralHistoryStatus,
    default: ReferralHistoryStatus.ALL,
    required: false
  })
  @IsOptional()
  @IsEnum(ReferralHistoryStatus)
  status?: ReferralHistoryStatus = ReferralHistoryStatus.ALL;

  @ApiProperty({
    description: 'Search term to filter by name or email',
    maxLength: 100,
    required: false
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiProperty({
    description: 'Field to sort by',
    enum: ReferralHistorySortBy,
    default: ReferralHistorySortBy.CREATED_AT,
    required: false
  })
  @IsOptional()
  @IsEnum(ReferralHistorySortBy)
  sortBy?: ReferralHistorySortBy = ReferralHistorySortBy.CREATED_AT;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
    required: false
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
