import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, IsObject, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum PrivacyModeEnum {
  PUBLIC = 'public',
  FRIENDS_ONLY = 'friends_only',
  PRIVATE = 'private'
}

export class RewardPreferencesDto {
  @ApiProperty({
    description: 'Preferred redemption method',
    example: 'account_credit',
    required: false
  })
  @IsOptional()
  @IsString()
  preferredRedemptionMethod?: string;

  @ApiProperty({
    description: 'Auto-redeem threshold amount',
    example: 100,
    required: false
  })
  @IsOptional()
  autoRedeemThreshold?: number;

  @ApiProperty({
    description: 'Whether auto-redeem is enabled',
    example: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  autoRedeemEnabled?: boolean;
}

export class UpdateReferralSettingsDto {
  @ApiProperty({
    description: 'Enable all referral notifications',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiProperty({
    description: 'Enable email notifications',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiProperty({
    description: 'Enable push notifications',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiProperty({
    description: 'Enable SMS notifications',
    example: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;

  @ApiProperty({
    description: 'Privacy mode for referrals',
    enum: PrivacyModeEnum,
    example: PrivacyModeEnum.PUBLIC,
    required: false
  })
  @IsOptional()
  @IsEnum(PrivacyModeEnum)
  privacyMode?: PrivacyModeEnum;

  @ApiProperty({
    description: 'Allow public sharing of referral statistics',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  allowPublicSharing?: boolean;

  @ApiProperty({
    description: 'Show user in referral leaderboards',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  showInLeaderboards?: boolean;

  @ApiProperty({
    description: 'Auto-generate share links',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  autoGenerateShareLinks?: boolean;

  @ApiProperty({
    description: 'Custom referral code',
    example: 'my_custom_code',
    maxLength: 50,
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim().toLowerCase())
  customReferralCode?: string;

  @ApiProperty({
    description: 'Use custom referral code instead of default',
    example: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  useCustomCode?: boolean;

  @ApiProperty({
    description: 'Reward preferences',
    type: RewardPreferencesDto,
    required: false
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RewardPreferencesDto)
  rewardPreferences?: RewardPreferencesDto;

  @ApiProperty({
    description: 'Allow marketing emails',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  allowMarketingEmails?: boolean;

  @ApiProperty({
    description: 'Allow third-party promotions',
    example: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  allowThirdPartyPromotions?: boolean;

  @ApiProperty({
    description: 'Allow analytics tracking',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  allowAnalyticsTracking?: boolean;

  @ApiProperty({
    description: 'Allow sharing success stories',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  shareSuccessStories?: boolean;
}

export class ReferralSettingsResponseDto extends UpdateReferralSettingsDto {
  @ApiProperty({
    description: 'Settings ID',
    example: '507f1f77bcf86cd799439011'
  })
  id: string;

  @ApiProperty({
    description: 'User ID these settings belong to',
    example: '507f1f77bcf86cd799439012'
  })
  userId: string;

  @ApiProperty({
    description: 'Date when settings were created',
    example: '2023-12-01T10:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date when settings were last updated',
    example: '2023-12-15T10:00:00.000Z'
  })
  updatedAt: Date;
}
