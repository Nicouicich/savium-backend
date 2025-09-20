import { IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AccountType } from '@common/constants/account-types';

export class CreateAccountDto {
  @ApiProperty({ description: 'Account name', example: 'Family Johnson', minLength: 2, maxLength: 100 })
  @IsString({ message: 'Account name must be a string' })
  @MinLength(2, { message: 'Account name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Account name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,!?()&']+$/, { message: 'Account name contains invalid characters' })
  @Transform(({ value }) => value?.trim()?.replace(/\s+/g, ' '))
  name: string;

  @ApiProperty({ description: 'Type of account', enum: AccountType, example: AccountType.FAMILY })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ description: 'Account description', example: 'Family transaction tracking account', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'Account description must be a string' })
  @MaxLength(500, { message: 'Account description cannot exceed 500 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,!?()&'\n\r]+$/, { message: 'Account description contains invalid characters' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiPropertyOptional({ description: 'Account currency (ISO 4217 code)', example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString({ message: 'Currency must be a string' })
  @Matches(/^[A-Z]{3}$/, { message: 'Currency must be a valid 3-letter ISO 4217 code' })
  currency?: string;

  @ApiPropertyOptional({ description: 'Account timezone (IANA timezone identifier)', example: 'America/New_York' })
  @IsOptional()
  @IsString({ message: 'Timezone must be a string' })
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+$/, { message: 'Timezone must be a valid IANA timezone identifier' })
  timezone?: string;

  @ApiPropertyOptional({ description: 'Privacy settings for the account', type: 'object' })
  @IsOptional()
  @IsObject({ message: 'Privacy settings must be an object' })
  privacySettings?: {
    transactionVisibility?: 'public' | 'private' | 'members_only';
    reportVisibility?: 'public' | 'private' | 'members_only';
    budgetVisibility?: 'public' | 'private' | 'members_only';
    allowPrivateTransactions?: boolean;
    childTransactionLimit?: number; // Maximum transaction amount for child users
    requireApproval?: boolean;
    approvalThreshold?: number; // Amount above which approval is required
  };

  @ApiPropertyOptional({ description: 'Account preferences', type: 'object' })
  @IsOptional()
  @IsObject({ message: 'Account preferences must be an object' })
  preferences?: {
    defaultCurrency?: string;
    dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY';
    timeFormat?: '12h' | '24h';
    weekStartDay?: 'sunday' | 'monday';
    fiscalYearStart?: number; // Month number (1-12)
    budgetPeriod?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    notificationFrequency?: 'instant' | 'daily' | 'weekly' | 'monthly';
    autoCategorizationEnabled?: boolean;
    receiptScanningEnabled?: boolean;
    multiCurrencyEnabled?: boolean;
  };
}
