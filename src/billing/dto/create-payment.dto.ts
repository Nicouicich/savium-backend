import { IsString, IsNumber, IsOptional, IsEnum, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PaymentMethodDto {
  @ApiProperty({ enum: ['card', 'bank_account', 'paypal', 'apple_pay', 'google_pay'] })
  @IsEnum(['card', 'bank_account', 'paypal', 'apple_pay', 'google_pay'])
  type: 'card' | 'bank_account' | 'paypal' | 'apple_pay' | 'google_pay';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  last4?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  expMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  expYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;
}

export class BillingDetailsDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => Object)
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export class CreatePaymentDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiProperty()
  @IsString()
  stripePaymentIntentId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripeChargeId?: string;

  @ApiProperty()
  @IsString()
  stripeCustomerId: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: ['succeeded', 'pending', 'failed', 'canceled', 'refunded', 'partially_refunded'] })
  @IsEnum(['succeeded', 'pending', 'failed', 'canceled', 'refunded', 'partially_refunded'])
  status: 'succeeded' | 'pending' | 'failed' | 'canceled' | 'refunded' | 'partially_refunded';

  @ApiProperty({ enum: ['subscription', 'one_time', 'upgrade', 'downgrade', 'addon'] })
  @IsEnum(['subscription', 'one_time', 'upgrade', 'downgrade', 'addon'])
  type: 'subscription' | 'one_time' | 'upgrade' | 'downgrade' | 'addon';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentMethodDto)
  paymentMethod?: PaymentMethodDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingDetailsDto)
  billingDetails?: BillingDetailsDto;
}
