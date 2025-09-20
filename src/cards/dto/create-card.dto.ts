import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsInt, MaxLength, Min, Max, Matches, ValidateIf, IsMongoId } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardBrand, CardType } from '@common/constants/card-types';

export class CreateCardDto {
  @ApiProperty({
    description: 'Display name for the card',
    example: 'Chase Sapphire Preferred',
    maxLength: 50
  })
  @IsNotEmpty({ message: 'Display name is required' })
  @IsString({ message: 'Display name must be a string' })
  @MaxLength(50, { message: 'Display name cannot exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  displayName: string;

  @ApiPropertyOptional({
    description: 'Last four digits of the card (encrypted for storage)',
    example: '1234',
    pattern: '^\\d{4}$'
  })
  @IsOptional()
  @IsString({ message: 'Last four digits must be a string' })
  @Matches(/^\d{4}$/, { message: 'Last four digits must be exactly 4 numbers' })
  lastFourDigits?: string;

  @ApiPropertyOptional({
    description: 'Card brand/network',
    enum: CardBrand,
    example: CardBrand.VISA
  })
  @IsOptional()
  @IsEnum(CardBrand, { message: 'Invalid card brand' })
  cardBrand?: CardBrand;

  @ApiProperty({
    description: 'Type of card',
    enum: CardType,
    example: CardType.CREDIT
  })
  @IsEnum(CardType, { message: 'Invalid card type' })
  cardType: CardType;

  @ApiPropertyOptional({
    description: 'Bank or financial institution that issued the card',
    example: 'Chase Bank',
    maxLength: 100
  })
  @IsOptional()
  @IsString({ message: 'Issuer bank must be a string' })
  @MaxLength(100, { message: 'Issuer bank cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  issuerBank?: string;

  @ApiPropertyOptional({
    description: 'Color for UI representation (hex format)',
    example: '#1E40AF',
    pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
  })
  @IsOptional()
  @IsString({ message: 'Color must be a string' })
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code'
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Icon identifier for UI',
    example: 'credit-card',
    maxLength: 50
  })
  @IsOptional()
  @IsString({ message: 'Icon must be a string' })
  @MaxLength(50, { message: 'Icon cannot exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  icon?: string;

  @ApiPropertyOptional({
    description: 'Credit limit for credit cards',
    example: 5000,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({}, { message: 'Credit limit must be a number' })
  @Min(0, { message: 'Credit limit cannot be negative' })
  @ValidateIf(o => o.cardType === CardType.CREDIT)
  creditLimit?: number;

  @ApiPropertyOptional({
    description: 'Day of month when billing cycle ends (1-31)',
    example: 15,
    minimum: 1,
    maximum: 31
  })
  @IsOptional()
  @IsInt({ message: 'Billing cycle day must be an integer' })
  @Min(1, { message: 'Billing cycle day must be between 1 and 31' })
  @Max(31, { message: 'Billing cycle day must be between 1 and 31' })
  billingCycleDay?: number;

  @ApiPropertyOptional({
    description: 'Annual interest rate percentage',
    example: 18.99,
    minimum: 0,
    maximum: 100
  })
  @IsOptional()
  @IsNumber({}, { message: 'Interest rate must be a number' })
  @Min(0, { message: 'Interest rate cannot be negative' })
  @Max(100, { message: 'Interest rate cannot exceed 100%' })
  interestRate?: number;

  @ApiPropertyOptional({
    description: 'Annual fee amount',
    example: 95,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({}, { message: 'Annual fee must be a number' })
  @Min(0, { message: 'Annual fee cannot be negative' })
  annualFee?: number;

  @ApiPropertyOptional({
    description: 'Card expiry month (1-12)',
    example: 12,
    minimum: 1,
    maximum: 12
  })
  @IsOptional()
  @IsInt({ message: 'Expiry month must be an integer' })
  @Min(1, { message: 'Expiry month must be between 1 and 12' })
  @Max(12, { message: 'Expiry month must be between 1 and 12' })
  expiryMonth?: number;

  @ApiPropertyOptional({
    description: 'Card expiry year',
    example: 2027,
    minimum: new Date().getFullYear()
  })
  @IsOptional()
  @IsInt({ message: 'Expiry year must be an integer' })
  @Min(new Date().getFullYear(), {
    message: `Expiry year cannot be earlier than ${new Date().getFullYear()}`
  })
  @Max(new Date().getFullYear() + 20, {
    message: `Expiry year cannot be more than 20 years in the future`
  })
  expiryYear?: number;

  @ApiProperty({
    description: 'Profile ID this card belongs to',
    example: '507f1f77bcf86cd799439011'
  })
  @IsMongoId({ message: 'Profile ID must be a valid MongoDB ObjectId' })
  profileId: string;
}
