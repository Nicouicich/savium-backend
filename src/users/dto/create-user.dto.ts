import {ApiProperty} from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
  Matches,
  IsIn,
  IsNumber,
  Min,
  Max
} from 'class-validator';
import {Transform, Type} from 'class-transformer';
import {UserRole} from '@common/constants/user-roles';
import {CreateProfileDto} from './create-profile.dto';

class NotificationPreferencesDto {
  @ApiProperty({description: 'Email notifications enabled', default: true})
  @IsOptional()
  @IsBoolean()
  email?: boolean = true;

  @ApiProperty({description: 'Push notifications enabled', default: true})
  @IsOptional()
  @IsBoolean()
  push?: boolean = true;

  @ApiProperty({description: 'SMS notifications enabled', default: false})
  @IsOptional()
  @IsBoolean()
  sms?: boolean = false;

  @ApiProperty({description: 'Marketing notifications enabled', default: false})
  @IsOptional()
  @IsBoolean()
  marketing?: boolean = false;
}

class PrivacyPreferencesDto {
  @ApiProperty({description: 'Data collection enabled', default: true})
  @IsOptional()
  @IsBoolean()
  dataCollection?: boolean = true;

  @ApiProperty({description: 'Analytics enabled', default: true})
  @IsOptional()
  @IsBoolean()
  analytics?: boolean = true;

  @ApiProperty({description: 'Third party sharing enabled', default: false})
  @IsOptional()
  @IsBoolean()
  thirdPartySharing?: boolean = false;
}

class DisplayPreferencesDto {
  @ApiProperty({description: 'Default currency (ISO 4217 code)', default: 'USD'})
  @IsOptional()
  @IsString({message: 'Currency must be a string'})
  @Matches(/^[A-Z]{3}$/, {message: 'Currency must be a valid 3-letter ISO 4217 code'})
  currency?: string = 'USD';

  @ApiProperty({description: 'Preferred language (ISO 639-1 code)', default: 'en'})
  @IsOptional()
  @IsString({message: 'Language must be a string'})
  @Matches(/^[a-z]{2}$/, {message: 'Language must be a valid 2-letter ISO 639-1 code'})
  language?: string = 'en';

  @ApiProperty({
    description: 'Theme preference',
    enum: ['light', 'dark', 'auto'],
    default: 'light'
  })
  @IsOptional()
  @IsEnum(['light', 'dark', 'auto'], {message: 'Theme must be light, dark, or auto'})
  theme?: 'light' | 'dark' | 'auto' = 'light';

  @ApiProperty({description: 'Date format', default: 'MM/DD/YYYY'})
  @IsOptional()
  @IsString({message: 'Date format must be a string'})
  @IsIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY'], {message: 'Date format must be one of: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY'})
  dateFormat?: string = 'MM/DD/YYYY';

  @ApiProperty({description: 'Time format', default: '12h'})
  @IsOptional()
  @IsString({message: 'Time format must be a string'})
  @IsIn(['12h', '24h'], {message: 'Time format must be either 12h or 24h'})
  timeFormat?: string = '12h';
}

class SecurityPreferencesDto {
  @ApiProperty({description: 'Two factor authentication enabled', default: false})
  @IsOptional()
  @IsBoolean({message: 'Two factor enabled must be a boolean'})
  twoFactorEnabled?: boolean = false;

  @ApiProperty({description: 'Session timeout in minutes (5-480)', default: 30, minimum: 5, maximum: 480})
  @IsOptional()
  @IsNumber({}, {message: 'Session timeout must be a number'})
  @Min(5, {message: 'Session timeout must be at least 5 minutes'})
  @Max(480, {message: 'Session timeout cannot exceed 8 hours (480 minutes)'})
  sessionTimeout?: number = 30;

  @ApiProperty({description: 'Require password change', default: false})
  @IsOptional()
  @IsBoolean({message: 'Require password change must be a boolean'})
  requirePasswordChange?: boolean = false;
}

class UserPreferencesDto {
  @ApiProperty({type: NotificationPreferencesDto})
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notifications?: NotificationPreferencesDto;

  @ApiProperty({type: PrivacyPreferencesDto})
  @IsOptional()
  @ValidateNested()
  @Type(() => PrivacyPreferencesDto)
  privacy?: PrivacyPreferencesDto;

  @ApiProperty({type: DisplayPreferencesDto})
  @IsOptional()
  @ValidateNested()
  @Type(() => DisplayPreferencesDto)
  display?: DisplayPreferencesDto;

  @ApiProperty({type: SecurityPreferencesDto})
  @IsOptional()
  @ValidateNested()
  @Type(() => SecurityPreferencesDto)
  security?: SecurityPreferencesDto;
}

export class CreateUserDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 2,
    maxLength: 50
  })
  @IsString({message: 'First name must be a string'})
  @MinLength(2, {message: 'First name must be at least 2 characters long'})
  @MaxLength(50, {message: 'First name must not exceed 50 characters'})
  @Matches(/^[a-zA-Z\s\-'àáâäèéêëìíîïòóôöùúûüñç]+$/, {message: 'First name contains invalid characters'})
  @Transform(({value}) => value?.trim()?.replace(/\s+/g, ' '))
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: 2,
    maxLength: 50
  })
  @IsString({message: 'Last name must be a string'})
  @MinLength(2, {message: 'Last name must be at least 2 characters long'})
  @MaxLength(50, {message: 'Last name must not exceed 50 characters'})
  @Matches(/^[a-zA-Z\s\-'àáâäèéêëìíîïòóôöùúûüñç]+$/, {message: 'Last name contains invalid characters'})
  @Transform(({value}) => value?.trim()?.replace(/\s+/g, ' '))
  lastName: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com'
  })
  @IsEmail({}, {message: 'Please provide a valid email address'})
  @Transform(({value}) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({
    description: 'User password (optional for OAuth users)',
    example: 'SecurePassword123!',
    minLength: 8,
    maxLength: 128,
    required: false
  })
  @IsOptional()
  @IsString({message: 'Password must be a string'})
  @MinLength(8, {message: 'Password must be at least 8 characters long'})
  @MaxLength(128, {message: 'Password must not exceed 128 characters'})
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  password?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    default: UserRole.USER,
    required: false
  })
  @IsOptional()
  @IsEnum(UserRole, {message: 'Invalid user role'})
  role?: UserRole = UserRole.USER;

  @ApiProperty({
    description: 'Phone number',
    example: '+1234567890',
    required: false
  })
  @IsOptional()
  @IsPhoneNumber(undefined, {message: 'Please provide a valid phone number'})
  phone?: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-01',
    required: false
  })
  @IsOptional()
  @IsDateString({}, {message: 'Please provide a valid date'})
  dateOfBirth?: string;

  @ApiProperty({
    description: 'User timezone (IANA timezone identifier)',
    example: 'America/New_York',
    required: false
  })
  @IsOptional()
  @IsString({message: 'Timezone must be a string'})
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+$/, {message: 'Timezone must be a valid IANA timezone identifier'})
  timezone?: string;

  @ApiProperty({
    description: 'User locale (RFC 5646 language tag)',
    example: 'en-US',
    required: false
  })
  @IsOptional()
  @IsString({message: 'Locale must be a string'})
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {message: 'Locale must be a valid RFC 5646 language tag (e.g., en-US, es-ES)'})
  locale?: string;

  @ApiProperty({
    description: 'User preferences',
    type: UserPreferencesDto,
    required: false
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;

  @ApiProperty({
    description: 'Default user profile',
    type: CreateProfileDto,
    required: false
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProfileDto)
  profile?: CreateProfileDto;
}
