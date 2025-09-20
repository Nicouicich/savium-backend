import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum StatsPeriod {
  LAST_7_DAYS = '7d',
  LAST_30_DAYS = '30d',
  LAST_90_DAYS = '90d',
  LAST_YEAR = '1y',
  ALL_TIME = 'all'
}

export class ReferralStatsQueryDto {
  @ApiProperty({
    description: 'Time period for statistics',
    enum: StatsPeriod,
    default: StatsPeriod.LAST_30_DAYS,
    required: false
  })
  @IsOptional()
  @IsEnum(StatsPeriod, { message: 'Invalid period specified' })
  period?: StatsPeriod = StatsPeriod.LAST_30_DAYS;

  @ApiProperty({
    description: 'Custom start date (ISO format)',
    example: '2023-01-01T00:00:00.000Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Custom end date (ISO format)',
    example: '2023-12-31T23:59:59.999Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Timezone for date calculations',
    example: 'America/New_York',
    default: 'UTC',
    required: false
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  timezone?: string = 'UTC';
}
