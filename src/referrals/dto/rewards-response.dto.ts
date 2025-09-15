import { ApiProperty } from '@nestjs/swagger';

export class ReferredUserSummaryDto {
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
}

export class RewardItemDto {
  @ApiProperty({
    description: 'Reward ID',
    example: '507f1f77bcf86cd799439011'
  })
  id: string;

  @ApiProperty({
    description: 'Information about the referred user',
    type: ReferredUserSummaryDto
  })
  referredUser: ReferredUserSummaryDto;

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
    description: 'Reward type',
    example: 'cash'
  })
  type: string;

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

  @ApiProperty({
    description: 'Expiration date for the reward',
    example: '2024-12-01T10:00:00.000Z',
    required: false
  })
  expiresAt?: Date;
}

export class RewardSummaryDto {
  @ApiProperty({
    description: 'Total available rewards amount',
    example: 120.0
  })
  totalAvailable: number;

  @ApiProperty({
    description: 'Total redeemed rewards amount',
    example: 50.0
  })
  totalRedeemed: number;

  @ApiProperty({
    description: 'Total pending rewards amount',
    example: 30.0
  })
  pendingAmount: number;

  @ApiProperty({
    description: 'Total lifetime rewards earned',
    example: 200.0
  })
  totalLifetime: number;

  @ApiProperty({
    description: 'Number of available rewards',
    example: 12
  })
  availableCount: number;

  @ApiProperty({
    description: 'Number of redeemed rewards',
    example: 5
  })
  redeemedCount: number;

  @ApiProperty({
    description: 'Number of pending rewards',
    example: 3
  })
  pendingCount: number;
}

export class RewardsResponseDto {
  @ApiProperty({
    description: 'List of reward items',
    type: [RewardItemDto]
  })
  data: RewardItemDto[];

  @ApiProperty({
    description: 'Summary of all rewards',
    type: RewardSummaryDto
  })
  summary: RewardSummaryDto;

  @ApiProperty({
    description: 'Pagination information',
    type: 'PaginationDto'
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
