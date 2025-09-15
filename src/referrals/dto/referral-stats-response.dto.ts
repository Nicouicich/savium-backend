import { ApiProperty } from '@nestjs/swagger';

export class ReferralOverviewDto {
  @ApiProperty({
    description: 'Total number of referrals',
    example: 25
  })
  totalReferrals: number;

  @ApiProperty({
    description: 'Number of successful referrals',
    example: 15
  })
  successfulReferrals: number;

  @ApiProperty({
    description: 'Number of pending referrals',
    example: 10
  })
  pendingReferrals: number;

  @ApiProperty({
    description: 'Conversion rate percentage',
    example: 60.0
  })
  conversionRate: number;

  @ApiProperty({
    description: 'Total rewards earned',
    example: 150.0
  })
  totalRewards: number;

  @ApiProperty({
    description: 'Available rewards for redemption',
    example: 120.0
  })
  availableRewards: number;

  @ApiProperty({
    description: 'Pending rewards not yet available',
    example: 30.0
  })
  pendingRewards: number;

  @ApiProperty({
    description: 'Total redeemed rewards',
    example: 50.0
  })
  redeemedRewards: number;
}

export class ChartDataPointDto {
  @ApiProperty({
    description: 'Date for the data point',
    example: '2023-12-01'
  })
  date: string;

  @ApiProperty({
    description: 'Number of referrals on this date',
    example: 3
  })
  referrals: number;

  @ApiProperty({
    description: 'Number of conversions on this date',
    example: 2
  })
  conversions: number;

  @ApiProperty({
    description: 'Conversion rate for this date',
    example: 66.67
  })
  conversionRate: number;
}

export class ReferralStatsResponseDto {
  @ApiProperty({
    description: 'Overview statistics',
    type: ReferralOverviewDto
  })
  overview: ReferralOverviewDto;

  @ApiProperty({
    description: 'Chart data for the requested period',
    type: [ChartDataPointDto]
  })
  chartData: ChartDataPointDto[];

  @ApiProperty({
    description: 'The period for which stats were calculated',
    example: '30d'
  })
  period: string;

  @ApiProperty({
    description: 'Start date of the period',
    example: '2023-11-01T00:00:00.000Z'
  })
  startDate: string;

  @ApiProperty({
    description: 'End date of the period',
    example: '2023-12-01T00:00:00.000Z'
  })
  endDate: string;
}
