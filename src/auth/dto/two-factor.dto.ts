import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Length, Matches } from 'class-validator';

export class SetupTwoFactorDto {
  @ApiProperty({
    description: 'Email of the user setting up 2FA',
    example: 'user@example.com'
  })
  @IsString({ message: 'Email must be a string' })
  email: string;
}

export class VerifyTwoFactorSetupDto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
    minLength: 6,
    maxLength: 6
  })
  @IsString({ message: 'Token must be a string' })
  @Length(6, 6, { message: 'Token must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Token must contain only digits' })
  token: string;
}

export class VerifyTwoFactorDto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app or 8-character backup code',
    example: '123456'
  })
  @IsString({ message: 'Token must be a string' })
  @Matches(/^(\d{6}|[A-F0-9]{8})$/, { message: 'Token must be a 6-digit code or 8-character backup code' })
  token: string;

  @ApiPropertyOptional({
    description: 'Challenge ID for critical operations',
    example: 'abcd1234efgh5678'
  })
  @IsOptional()
  @IsString({ message: 'Challenge ID must be a string' })
  challengeId?: string;

  @ApiPropertyOptional({
    description: 'Operation being performed (for audit logs)',
    example: 'password_change'
  })
  @IsOptional()
  @IsString({ message: 'Operation must be a string' })
  operation?: string;
}

export class DisableTwoFactorDto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
    minLength: 6,
    maxLength: 6
  })
  @IsString({ message: 'Token must be a string' })
  @Length(6, 6, { message: 'Token must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Token must contain only digits' })
  token: string;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty({
    description: 'QR code as data URL for easy scanning',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
  })
  qrCodeUrl: string;

  @ApiProperty({
    description: 'Secret key for manual entry',
    example: 'JBSWY3DPEHPK3PXP'
  })
  secretKey: string;

  @ApiProperty({
    description: 'Backup codes for account recovery',
    example: ['A1B2C3D4', 'E5F6G7H8', 'I9J0K1L2']
  })
  backupCodes: string[];

  @ApiProperty({
    description: 'Instructions for setting up 2FA',
    example: 'Scan the QR code with your authenticator app and enter the 6-digit code to verify setup.'
  })
  instructions: string;
}

export class TwoFactorStatusDto {
  @ApiProperty({
    description: 'Whether 2FA is enabled for the user',
    example: true
  })
  enabled: boolean;

  @ApiProperty({
    description: 'Number of backup codes remaining',
    example: 8
  })
  backupCodesRemaining?: number;

  @ApiProperty({
    description: 'When 2FA was enabled',
    example: '2024-01-15T10:30:00Z'
  })
  enabledAt?: Date;
}

export class TwoFactorChallengeDto {
  @ApiProperty({
    description: 'Challenge ID to be used with subsequent verification',
    example: 'abcd1234efgh5678'
  })
  challengeId: string;

  @ApiProperty({
    description: 'Operation requiring 2FA verification',
    example: 'password_change'
  })
  operation: string;

  @ApiProperty({
    description: 'Time when challenge expires',
    example: '2024-01-15T10:35:00Z'
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'Instructions for completing the challenge',
    example: 'Enter your 6-digit authenticator code to complete this operation.'
  })
  message: string;
}

export class RegenerateBackupCodesDto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
    minLength: 6,
    maxLength: 6
  })
  @IsString({ message: 'Token must be a string' })
  @Length(6, 6, { message: 'Token must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Token must contain only digits' })
  token: string;
}
