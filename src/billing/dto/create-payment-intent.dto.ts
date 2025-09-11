import {IsString, IsNumber, IsOptional, IsArray, IsEnum, Min, MaxLength, IsIn} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Transform} from 'class-transformer';

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'User ID who is making the payment',
    example: '60d0fe4f5311236168a109ca'
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Account ID associated with this payment',
    example: '60d0fe4f5311236168a109cb'
  })
  @IsString()
  accountId: string;

  @ApiProperty({
    description: "Payment amount in the currency's smallest unit (e.g., cents for USD)",
    example: 2999,
    minimum: 1
  })
  @IsNumber()
  @Min(1)
  @Transform(({value}) => Math.round(value * 100) / 100) // Ensure 2 decimal places
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code (ISO 4217)',
    example: 'usd',
    default: 'usd'
  })
  @IsOptional()
  @IsString()
  @IsIn(['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'nok', 'sek', 'dkk'])
  currency?: string;

  @ApiPropertyOptional({
    description: 'Description of the payment',
    example: 'Premium subscription upgrade',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Allowed payment method types',
    example: ['card', 'us_bank_account'],
    default: ['card']
  })
  @IsOptional()
  @IsArray()
  @IsString({each: true})
  paymentMethodTypes?: string[];

  @ApiPropertyOptional({
    description: 'Capture method for the payment',
    example: 'automatic',
    enum: ['automatic', 'manual'],
    default: 'automatic'
  })
  @IsOptional()
  @IsEnum(['automatic', 'manual'])
  captureMethod?: 'automatic' | 'manual';

  @ApiPropertyOptional({
    description: 'Additional metadata for the payment',
    example: {orderId: 'order_123', customField: 'value'}
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
