import { IsNumber, IsOptional, IsDateString, IsEnum, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { BalanceUpdateSource } from '@common/constants/card-types';
import { Currency } from '@common/constants/transaction-categories';

export class CreateCardBalanceDto {
  @ApiProperty({
    description: 'Current balance on the card',
    example: 1250.5,
    minimum: 0
  })
  @IsNumber({}, { message: 'Current balance must be a number' })
  @Transform(({ value }) => Number(value))
  currentBalance: number;

  @ApiPropertyOptional({
    description: 'Available credit (for credit cards)',
    example: 3749.5,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({}, { message: 'Available credit must be a number' })
  @Min(0, { message: 'Available credit cannot be negative' })
  @Transform(({ value }) => (value ? Number(value) : undefined))
  availableCredit?: number;

  @ApiPropertyOptional({
    description: 'Minimum payment amount due',
    example: 25.0,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({}, { message: 'Minimum payment must be a number' })
  @Min(0, { message: 'Minimum payment cannot be negative' })
  @Transform(({ value }) => (value ? Number(value) : undefined))
  minimumPayment?: number;

  @ApiPropertyOptional({
    description: 'Payment due date',
    example: '2024-01-15T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString({}, { message: 'Payment due date must be a valid date' })
  paymentDueDate?: string;

  @ApiPropertyOptional({
    description: 'Currency of the balance',
    enum: Currency,
    example: Currency.USD
  })
  @IsOptional()
  @IsEnum(Currency, { message: 'Invalid currency' })
  currency?: Currency;

  @ApiPropertyOptional({
    description: 'Statement period start date',
    example: '2023-12-15T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString({}, { message: 'Statement start date must be a valid date' })
  statementStartDate?: string;

  @ApiPropertyOptional({
    description: 'Statement period end date',
    example: '2024-01-14T23:59:59.999Z'
  })
  @IsOptional()
  @IsDateString({}, { message: 'Statement end date must be a valid date' })
  statementEndDate?: string;

  @ApiPropertyOptional({
    description: 'Statement balance amount',
    example: 1150.0
  })
  @IsOptional()
  @IsNumber({}, { message: 'Statement balance must be a number' })
  @Transform(({ value }) => (value ? Number(value) : undefined))
  statementBalance?: number;

  @ApiPropertyOptional({
    description: 'Whether this update was automatic',
    example: false
  })
  @IsOptional()
  @IsBoolean({ message: 'isAutomaticUpdate must be a boolean' })
  isAutomaticUpdate?: boolean;

  @ApiPropertyOptional({
    description: 'Source of the balance update',
    enum: BalanceUpdateSource,
    example: BalanceUpdateSource.MANUAL
  })
  @IsOptional()
  @IsEnum(BalanceUpdateSource, { message: 'Invalid update source' })
  updateSource?: BalanceUpdateSource;

  @ApiPropertyOptional({
    description: 'Late fees charged',
    example: 35.0,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({}, { message: 'Late fees must be a number' })
  @Min(0, { message: 'Late fees cannot be negative' })
  @Transform(({ value }) => (value ? Number(value) : undefined))
  lateFees?: number;

  @ApiPropertyOptional({
    description: 'Interest charges',
    example: 15.75,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({}, { message: 'Interest charges must be a number' })
  @Min(0, { message: 'Interest charges cannot be negative' })
  @Transform(({ value }) => (value ? Number(value) : undefined))
  interestCharges?: number;
}

export class UpdateCardBalanceDto extends CreateCardBalanceDto {}

export class CardBalanceQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for balance history',
    example: '2023-01-01T00:00:00.000Z'
  })
  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid date' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for balance history',
    example: '2023-12-31T23:59:59.999Z'
  })
  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid date' })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Include only overdue balances',
    example: false
  })
  @IsOptional()
  @IsBoolean({ message: 'overdueOnly must be a boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  overdueOnly?: boolean;
}
