import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ enum: ['free', 'basic', 'premium', 'family', 'business'] })
  @IsEnum(['free', 'basic', 'premium', 'family', 'business'])
  plan: 'free' | 'basic' | 'premium' | 'family' | 'business';

  @ApiProperty({ enum: ['monthly', 'yearly', 'lifetime'] })
  @IsEnum(['monthly', 'yearly', 'lifetime'])
  interval: 'monthly' | 'yearly' | 'lifetime';

  @ApiProperty()
  @IsString()
  stripeSubscriptionId: string;

  @ApiProperty()
  @IsString()
  stripeCustomerId: string;

  @ApiProperty()
  @IsString()
  stripePriceId: string;

  @ApiProperty()
  @IsString()
  stripeProductId: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty()
  @IsDateString()
  currentPeriodStart: Date;

  @ApiProperty()
  @IsDateString()
  currentPeriodEnd: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  trialStart?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  trialEnd?: Date;
}
