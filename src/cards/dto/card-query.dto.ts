import { CardBrand, CardStatus, CardType } from '@common/constants/card-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';

export class CardQueryDto {
  @ApiPropertyOptional({
    description: 'Profile ID to filter cards',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsMongoId({ message: 'Profile ID must be a valid MongoDB ObjectId' })
  profileId?: string;

  @ApiPropertyOptional({
    description: 'Filter by card type',
    enum: CardType,
    example: CardType.CREDIT
  })
  @IsOptional()
  @IsEnum(CardType, { message: 'Invalid card type' })
  cardType?: CardType;

  @ApiPropertyOptional({
    description: 'Filter by card brand',
    enum: CardBrand,
    example: CardBrand.VISA
  })
  @IsOptional()
  @IsEnum(CardBrand, { message: 'Invalid card brand' })
  cardBrand?: CardBrand;

  @ApiPropertyOptional({
    description: 'Filter by card status',
    enum: CardStatus,
    example: CardStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(CardStatus, { message: 'Invalid card status' })
  status?: CardStatus;

  @ApiPropertyOptional({
    description: 'Include only default cards',
    example: false
  })
  @IsOptional()
  @IsBoolean({ message: 'isDefault must be a boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Include only expired cards',
    example: false
  })
  @IsOptional()
  @IsBoolean({ message: 'isExpired must be a boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  isExpired?: boolean;

  @ApiPropertyOptional({
    description: 'Search by display name or issuer bank',
    example: 'Chase'
  })
  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'displayName',
    enum: ['displayName', 'cardType', 'cardBrand', 'createdAt', 'updatedAt']
  })
  @IsOptional()
  @IsString({ message: 'Sort field must be a string' })
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'asc',
    enum: ['asc', 'desc']
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'Sort order must be asc or desc' })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    minimum: 1
  })
  @IsOptional()
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  @Transform(({ value }) => parseInt(value))
  limit?: number;

  @ApiPropertyOptional({
    description: 'Include deleted cards',
    example: false
  })
  @IsOptional()
  @IsBoolean({ message: 'includeDeleted must be a boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean;
}
