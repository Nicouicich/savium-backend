import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * DTO for sending SMS verification code
 */
export class SendSmsDto {
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
}
