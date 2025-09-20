import { Currency, PaymentMethod } from '@common/constants/transaction-categories';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsDecimal,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested
} from 'class-validator';

export class CreateInstallmentDto {
  @IsNumber()
  @Min(2)
  total: number;

  @IsNumber()
  @Min(1)
  current: number;
}

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Transaction description',
    example: 'Lunch at Italian restaurant',
    minLength: 1,
    maxLength: 200
  })
  @IsString({ message: 'Description must be a string' })
  @MinLength(1, { message: 'Description cannot be empty' })
  @MaxLength(200, { message: 'Description cannot exceed 200 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,!?()&]+$/, { message: 'Description contains invalid characters' })
  @Transform(({ value }) => value?.trim())
  description: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 45.5,
    minimum: 0.01,
    maximum: 999999.99
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Max(999999.99, { message: 'Amount cannot exceed 999,999.99' })
  amount: number;

  @ApiPropertyOptional({ description: 'Currency code', example: Currency.USD })
  @IsOptional()
  /*   @IsEnum(Currency) */
  currency: string;

  @ApiProperty({ description: 'Transaction date (ISO 8601 format)', example: '2024-01-15T12:30:00.000Z' })
  @IsDateString({}, { message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' })
  @IsOptional()
  @Type(() => Date)
  date?: Date;

  @ApiProperty({
    description: 'Category ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString({ message: 'Category ID must be a string' })
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Subcategory name', example: 'restaurant', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subcategoryName?: string;

  @ApiProperty({
    description: 'Profile ID (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString({ message: 'Profile ID must be a string' })
  profileId: string;

  @ApiPropertyOptional({ description: 'Payment method', enum: PaymentMethod, example: PaymentMethod.CREDIT_CARD })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
  @ApiPropertyOptional({ description: 'Payment method ID reference', example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsMongoId({ message: 'Payment method ID must be a valid MongoDB ObjectId' })
  paymentMethodId?: string;

  @ApiPropertyOptional({ description: 'Card ID for card payments', example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsMongoId({ message: 'Card ID must be a valid MongoDB ObjectId' })
  cardId?: string;

  @ApiPropertyOptional({ description: 'Whether this is a recurring transaction', example: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Tags for transaction organization', type: [String], example: ['business', 'client_meeting'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  tags?: string[];

  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isInstallment?: boolean;

  @IsOptional()
  @ValidateNested()
  @ValidateIf(o => o.isInstallment === true)
  @Type(() => CreateInstallmentDto)
  installment?: CreateInstallmentDto;
}
