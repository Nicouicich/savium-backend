import { IsEnum, IsOptional, IsString, MaxLength, MinLength, Matches, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ProfileType } from 'src/financial-profiles/schemas';

export class CreateProfileDto {
  @ApiProperty({
    description: 'Profile type',
    enum: ProfileType,
    example: ProfileType.PERSONAL
  })
  @IsEnum(ProfileType, { message: 'Invalid profile type' })
  type: ProfileType;

  @ApiProperty({
    description: 'Profile name',
    example: 'Personal',
    minLength: 2,
    maxLength: 100
  })
  @IsString({ message: 'Profile name must be a string' })
  @MinLength(2, { message: 'Profile name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Profile name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,!?()&']+$/, {
    message: 'Profile name contains invalid characters'
  })
  @Transform(({ value }) => value?.trim()?.replace(/\s+/g, ' '))
  name: string;

  @ApiPropertyOptional({
    description: 'Profile description',
    example: 'My personal transactions',
    maxLength: 500
  })
  @IsOptional()
  @IsString({ message: 'Profile description must be a string' })
  @MaxLength(500, { message: 'Profile description cannot exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiPropertyOptional({
    description: 'Profile currency (ISO 4217 code)',
    example: 'USD',
    default: 'USD'
  })
  @IsOptional()
  @IsString({ message: 'Currency must be a string' })
  @Matches(/^[A-Z]{3}$/, { message: 'Currency must be a valid 3-letter ISO 4217 code' })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Profile timezone (IANA timezone identifier)',
    example: 'America/Argentina/Buenos_Aires'
  })
  @IsOptional()
  @IsString({ message: 'Timezone must be a string' })
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+$/, {
    message: 'Timezone must be a valid IANA timezone identifier'
  })
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Profile settings',
    type: 'object'
  })
  @IsOptional()
  @IsObject({ message: 'Settings must be an object' })
  settings?: {
    privacy?: {
      transactionVisibility?: 'private' | 'members_only' | 'public';
      reportVisibility?: 'private' | 'members_only' | 'public';
      budgetVisibility?: 'private' | 'members_only' | 'public';
      allowPrivateTransactions?: boolean;
      childTransactionLimit?: number;
      requireApproval?: boolean;
      approvalThreshold?: number;
    };
    notifications?: {
      enabled?: boolean;
      frequency?: 'instant' | 'daily' | 'weekly' | 'monthly';
      channels?: ('email' | 'whatsapp' | 'telegram' | 'push')[];
    };
    preferences?: {
      dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY';
      timeFormat?: '12h' | '24h';
      weekStartDay?: 'sunday' | 'monday';
      autoCategorizationEnabled?: boolean;
      receiptScanningEnabled?: boolean;
    };
  };
}
