import { ApiProperty } from '@nestjs/swagger';

export class ReferrerInfoDto {
  @ApiProperty({
    description: 'Full name of the referrer',
    example: 'John Doe'
  })
  name: string;

  @ApiProperty({
    description: 'Email of the referrer',
    example: 'john@example.com'
  })
  email: string;

  @ApiProperty({
    description: 'Total successful referrals made by this user',
    example: 15,
    required: false
  })
  totalReferrals?: number;
}

export class ValidateReferralResponseDto {
  @ApiProperty({
    description: 'Whether the referral code is valid',
    example: true
  })
  valid: boolean;

  @ApiProperty({
    description: 'Message explaining the validation result',
    example: 'Valid referral code'
  })
  message: string;

  @ApiProperty({
    description: 'Information about the referrer',
    type: ReferrerInfoDto,
    required: false
  })
  referrerInfo?: ReferrerInfoDto;
}
