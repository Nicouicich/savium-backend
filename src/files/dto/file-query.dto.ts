import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { FilePurpose, FileStatus, FileType } from '../schemas/file-metadata.schema';

export class FileQueryDto {
  @ApiProperty({
    description: 'Filter by file type',
    enum: FileType,
    required: false,
    example: FileType.IMAGE
  })
  @IsOptional()
  @IsEnum(FileType)
  fileType?: FileType;

  @ApiProperty({
    description: 'Filter by file purpose',
    enum: FilePurpose,
    required: false,
    example: FilePurpose.RECEIPT
  })
  @IsOptional()
  @IsEnum(FilePurpose)
  purpose?: FilePurpose;

  @ApiProperty({
    description: 'Filter by file status',
    enum: FileStatus,
    required: false,
    example: FileStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(FileStatus)
  status?: FileStatus = FileStatus.ACTIVE;

  @ApiProperty({
    description: 'Filter by account ID',
    example: '507f1f77bcf86cd799439012',
    required: false
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiProperty({
    description: 'Filter by uploader user ID',
    example: '507f1f77bcf86cd799439011',
    required: false
  })
  @IsOptional()
  @IsUUID()
  uploadedBy?: string;

  @ApiProperty({
    description: 'Filter by upload source',
    example: 'whatsapp',
    required: false
  })
  @IsOptional()
  @IsString()
  uploadSource?: string;

  @ApiProperty({
    description: 'Filter by tags (comma-separated)',
    example: 'receipt,business',
    required: false
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value ? value.split(',').map((tag: string) => tag.trim()) : undefined))
  tags?: string[];

  @ApiProperty({
    description: 'Search in filename, description, and extracted text',
    example: 'coffee shop',
    required: false
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by private status',
    example: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPrivate?: boolean;

  @ApiProperty({
    description: 'Filter by creation date from (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description: 'Filter by creation date to (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description: 'Minimum file size in bytes',
    example: 1024,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minSize?: number;

  @ApiProperty({
    description: 'Maximum file size in bytes',
    example: 10485760,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxSize?: number;

  @ApiProperty({
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'size', 'originalName', 'lastAccessedAt'],
    example: 'createdAt',
    required: false
  })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'updatedAt' | 'size' | 'originalName' | 'lastAccessedAt' = 'createdAt';

  @ApiProperty({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
    required: false
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiProperty({
    description: 'Page number (1-based)',
    example: 1,
    minimum: 1,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Include soft-deleted files',
    example: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean = false;
}

export class FileStatsDto {
  @ApiProperty({
    description: 'Filter stats by account ID',
    example: '507f1f77bcf86cd799439012',
    required: false
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiProperty({
    description: 'Filter stats by user ID',
    example: '507f1f77bcf86cd799439011',
    required: false
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: 'Stats period start date',
    example: '2024-01-01T00:00:00.000Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description: 'Stats period end date',
    example: '2024-12-31T23:59:59.999Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description: 'Group stats by period',
    enum: ['day', 'week', 'month', 'year'],
    example: 'month',
    required: false
  })
  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'year'])
  groupBy?: 'day' | 'week' | 'month' | 'year';
}
