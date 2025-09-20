import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ApplyReferralDto {
  @ApiProperty({
    description: 'The referral code to apply (username or email of the referrer)',
    example: 'john_doe or john@example.com',
    maxLength: 100
  })
  @IsString({ message: 'Referral code must be a string' })
  @IsNotEmpty({ message: 'Referral code cannot be empty' })
  @MaxLength(100, { message: 'Referral code cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  referralCode: string;
}
