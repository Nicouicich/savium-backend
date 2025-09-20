import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsHexColor, MinLength, MaxLength, IsMongoId } from 'class-validator';
import { Types } from 'mongoose';

export class CreateTagDto {
  @ApiProperty({
    description: 'Tag name',
    example: 'Work',
    minLength: 1,
    maxLength: 50
  })
  @IsString()
  @MinLength(1, { message: 'Tag name is required' })
  @MaxLength(50, { message: 'Tag name must be less than 50 characters' })
  name: string;

  @ApiProperty({
    description: 'Tag color in hex format',
    example: '#3B82F6'
  })
  @IsString()
  @IsHexColor({ message: 'Color must be a valid hex color' })
  color: string;

  @ApiProperty({
    description: 'Tag description',
    example: 'Work-related transactions',
    required: false,
    maxLength: 200
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Description must be less than 200 characters' })
  description?: string;

  @ApiProperty({
    description: 'Profile ID to associate the tag with',
    example: '60f4b1b3b3f3b3f3b3f3b3f3',
    required: false
  })
  @IsOptional()
  @IsMongoId({ message: 'Profile ID must be a valid MongoDB ObjectId' })
  profileId?: Types.ObjectId;
}

export class UpdateTagDto {
  @ApiProperty({
    description: 'Tag name',
    example: 'Work',
    minLength: 1,
    maxLength: 50,
    required: false
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Tag name is required' })
  @MaxLength(50, { message: 'Tag name must be less than 50 characters' })
  name?: string;

  @ApiProperty({
    description: 'Tag color in hex format',
    example: '#3B82F6',
    required: false
  })
  @IsOptional()
  @IsString()
  @IsHexColor({ message: 'Color must be a valid hex color' })
  color?: string;

  @ApiProperty({
    description: 'Tag description',
    example: 'Work-related transactions',
    required: false,
    maxLength: 200
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Description must be less than 200 characters' })
  description?: string;
}

export class TagResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  color: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ required: false })
  profileId?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  usageCount: number;

  @ApiProperty({ required: false })
  lastUsedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class TagsListResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: [TagResponseDto] })
  data: TagResponseDto[];

  @ApiProperty()
  timestamp: string;
}

export class TagCreatedResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: TagResponseDto })
  data: TagResponseDto;

  @ApiProperty()
  timestamp: string;
}
