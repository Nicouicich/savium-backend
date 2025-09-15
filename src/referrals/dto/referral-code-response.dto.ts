import { ApiProperty } from '@nestjs/swagger';

export class ReferralCodeResponseDto {
  @ApiProperty({
    description: 'The user referral code',
    example: 'john_doe'
  })
  code: string;

  @ApiProperty({
    description: 'Complete share URL for the referral',
    example: 'https://app.savium.com/signup?ref=john_doe'
  })
  shareUrl: string;

  @ApiProperty({
    description: 'Total number of referrals made by the user',
    example: 15
  })
  totalReferrals: number;

  @ApiProperty({
    description: 'Number of successful (completed) referrals',
    example: 8
  })
  successfulReferrals: number;

  @ApiProperty({
    description: 'Number of pending (incomplete) referrals',
    example: 7
  })
  pendingReferrals: number;

  @ApiProperty({
    description: 'Conversion rate percentage',
    example: 53.33
  })
  conversionRate: number;
}
