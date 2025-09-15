import { ApiProperty } from '@nestjs/swagger';

export class ReferralRewardDto {
  @ApiProperty({
    description: 'Reward ID',
    example: '507f1f77bcf86cd799439011'
  })
  id: string;

  @ApiProperty({
    description: 'Reward type',
    example: 'cash'
  })
  type: string;

  @ApiProperty({
    description: 'Reward amount',
    example: 10.0
  })
  amount: number;

  @ApiProperty({
    description: 'Reward currency',
    example: 'USD'
  })
  currency: string;

  @ApiProperty({
    description: 'Reward status',
    example: 'available'
  })
  status: string;

  @ApiProperty({
    description: 'Date when reward was created',
    example: '2023-12-01T10:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date when reward was redeemed',
    example: '2023-12-15T10:00:00.000Z',
    required: false
  })
  redeemedAt?: Date;
}

export class ReferralHistoryItemDto {
  @ApiProperty({
    description: 'Referred user ID',
    example: '507f1f77bcf86cd799439011'
  })
  id: string;

  @ApiProperty({
    description: 'Referred user email',
    example: 'jane@example.com'
  })
  email: string;

  @ApiProperty({
    description: 'Referred user full name',
    example: 'Jane Smith'
  })
  name: string;

  @ApiProperty({
    description: 'Date when user registered',
    example: '2023-12-01T10:00:00.000Z'
  })
  registeredAt: Date;

  @ApiProperty({
    description: 'Date when referral was completed',
    example: '2023-12-08T10:00:00.000Z',
    required: false
  })
  completedAt?: Date;

  @ApiProperty({
    description: 'Current referral status',
    example: 'completed'
  })
  status: string;

  @ApiProperty({
    description: 'Days since registration',
    example: 15
  })
  daysSinceRegistration: number;

  @ApiProperty({
    description: 'Active days count',
    example: 8
  })
  activeDaysCount: number;

  @ApiProperty({
    description: 'Associated reward information',
    type: ReferralRewardDto,
    required: false
  })
  reward?: ReferralRewardDto;
}

export class PaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 25
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false
  })
  hasPrev: boolean;
}

export class ReferralHistoryResponseDto {
  @ApiProperty({
    description: 'List of referral history items',
    type: [ReferralHistoryItemDto]
  })
  data: ReferralHistoryItemDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationDto
  })
  pagination: PaginationDto;
}
