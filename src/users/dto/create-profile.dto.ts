import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ProfilePrivacyDto {
  @ApiProperty({ enum: ['public', 'private', 'connections'], default: 'private' })
  @IsOptional()
  @IsEnum(['public', 'private', 'connections'])
  visibility?: 'public' | 'private' | 'connections';

  @ApiProperty({ default: false })
  @IsOptional()
  showContactInfo?: boolean;

  @ApiProperty({ default: false })
  @IsOptional()
  showSocialLinks?: boolean;

  @ApiProperty({ default: false })
  @IsOptional()
  indexInSearchEngines?: boolean;
}

export class CreateProfileDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profession?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ enum: ['personal', 'professional', 'business', 'family'], default: 'personal' })
  @IsOptional()
  @IsEnum(['personal', 'professional', 'business', 'family'])
  profileType?: 'personal' | 'professional' | 'business' | 'family';

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfilePrivacyDto)
  privacy?: ProfilePrivacyDto;

  @ApiPropertyOptional()
  @IsOptional()
  isDefault?: boolean;
}
