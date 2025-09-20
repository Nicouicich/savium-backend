import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export enum RewardStatusFilter {
  ALL = 'all',
  PENDING = 'pending',
  AVAILABLE = 'available',
  REDEEMED = 'redeemed',
  EXPIRED = 'expired'
}

export class RewardsQueryDto {
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
    description: 'Filter by reward status',
    enum: RewardStatusFilter,
    default: RewardStatusFilter.ALL,
    required: false
  })
  @IsOptional()
  @IsEnum(RewardStatusFilter)
  status?: RewardStatusFilter = RewardStatusFilter.ALL;
}
