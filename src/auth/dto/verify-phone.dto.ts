import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for verifying phone number for existing users
 */
export class VerifyPhoneDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+1234567890',
    pattern: '^\\+[1-9]\\d{1,14}$'
  })
  @IsString({ message: 'Phone number must be a string' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in international format (e.g., +1234567890)'
  })
  @Transform(({ value }) => value?.replace(/[^\d+]/g, ''))
  phoneNumber: string;

  @ApiProperty({
    description: 'SMS verification ID received from send SMS request',
    example: 'ver_abc123def456789_1640995200000'
  })
  @IsString({ message: 'Verification ID must be a string' })
  @IsNotEmpty({ message: 'Verification ID is required' })
  @Length(10, 100, { message: 'Verification ID must be between 10 and 100 characters' })
  verificationId: string;

  @ApiProperty({
    description: 'SMS verification code received via SMS',
    example: '123456',
    minLength: 4,
    maxLength: 8
  })
  @IsString({ message: 'Verification code must be a string' })
  @IsNotEmpty({ message: 'Verification code is required' })
  @Length(4, 8, { message: 'Verification code must be between 4 and 8 characters' })
  @Matches(/^\d+$/, { message: 'Verification code must contain only numbers' })
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  verificationCode: string;
}
