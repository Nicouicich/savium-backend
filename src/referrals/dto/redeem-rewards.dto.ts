import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export enum RedemptionMethodEnum {
  BANK_TRANSFER = 'bank_transfer',
  PAYPAL = 'paypal',
  GIFT_CARD = 'gift_card',
  ACCOUNT_CREDIT = 'account_credit',
  CRYPTO = 'crypto'
}

export class RedeemRewardsDto {
  @ApiProperty({
    description: 'Array of reward IDs to redeem',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    type: [String]
  })
  @IsArray({ message: 'Reward IDs must be an array' })
  @ArrayMinSize(1, { message: 'At least one reward ID is required' })
  @IsString({ each: true, message: 'Each reward ID must be a string' })
  rewardIds: string[];

  @ApiProperty({
    description: 'Method for redeeming the rewards',
    enum: RedemptionMethodEnum,
    example: RedemptionMethodEnum.BANK_TRANSFER
  })
  @IsEnum(RedemptionMethodEnum, { message: 'Invalid redemption method' })
  redemptionMethod: RedemptionMethodEnum;

  @ApiProperty({
    description: 'Details for the redemption (bank account, PayPal email, etc.)',
    example: {
      bankAccount: '1234567890',
      routingNumber: '123456789',
      accountHolderName: 'John Doe'
    },
    required: false
  })
  @IsOptional()
  @IsObject({ message: 'Redemption details must be an object' })
  redemptionDetails?: Record<string, any>;
}

export class RedeemRewardsResponseDto {
  @ApiProperty({
    description: 'Whether the redemption was successful',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Total amount redeemed',
    example: 50.0
  })
  totalAmount: number;

  @ApiProperty({
    description: 'Currency of the redeemed amount',
    example: 'USD'
  })
  currency: string;

  @ApiProperty({
    description: 'Number of rewards redeemed',
    example: 5
  })
  rewardsCount: number;

  @ApiProperty({
    description: 'Redemption method used',
    example: 'bank_transfer'
  })
  redemptionMethod: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Successfully redeemed $50.00 via bank transfer'
  })
  message: string;

  @ApiProperty({
    description: 'Transaction reference ID',
    example: 'TXN_507f1f77bcf86cd799439011',
    required: false
  })
  transactionId?: string;

  @ApiProperty({
    description: 'Estimated processing time',
    example: '3-5 business days',
    required: false
  })
  processingTime?: string;
}
