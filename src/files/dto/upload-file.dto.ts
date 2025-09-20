import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsBoolean, IsArray, IsUUID, MaxLength, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';
import { FilePurpose, FileType } from '../schemas/file-metadata.schema';

export class UploadFileDto {
  @ApiProperty({
    description: 'Purpose/category of the file',
    enum: FilePurpose,
    example: FilePurpose.RECEIPT,
    required: false
  })
  @IsOptional()
  @IsEnum(FilePurpose)
  purpose?: FilePurpose = FilePurpose.GENERAL;

  @ApiProperty({
    description: 'File description or notes',
    example: 'Receipt from business lunch with client',
    required: false,
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'File tags for organization',
    example: ['receipt', 'business', 'restaurant'],
    required: false,
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  tags?: string[] = [];

  @ApiProperty({
    description: 'Whether file should be marked as private/sensitive',
    example: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPrivate?: boolean = false;

  @ApiProperty({
    description: 'Account ID to associate the file with',
    example: '507f1f77bcf86cd799439012',
    required: false
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiProperty({
    description: 'Upload source identifier',
    example: 'whatsapp',
    required: false
  })
  @IsOptional()
  @IsString()
  uploadSource?: string = 'web';

  @ApiProperty({
    description: 'Additional metadata for the file',
    example: { relatedTransactionId: '507f1f77bcf86cd799439013' },
    required: false
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> = {};
}

export class FileUploadResponseDto {
  @ApiProperty({
    description: 'Unique file identifier',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  fileId: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'receipt.jpg'
  })
  originalName: string;

  @ApiProperty({
    description: 'File type',
    enum: FileType,
    example: FileType.IMAGE
  })
  fileType: FileType;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576
  })
  size: number;

  @ApiProperty({
    description: 'S3 object key',
    example: 'uploads/users/123/receipts/2024/01/550e8400-e29b-41d4-a716-446655440000.jpg'
  })
  s3Key: string;

  @ApiProperty({
    description: 'File URL (if public)',
    example: 'https://savium-uploads.s3.amazonaws.com/uploads/users/123/receipts/2024/01/file.jpg'
  })
  url?: string;

  @ApiProperty({
    description: 'CDN URL if available',
    example: 'https://cdn.savium.com/uploads/users/123/receipts/2024/01/file.jpg'
  })
  cdnUrl?: string;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2024-01-01T00:00:00.000Z'
  })
  uploadedAt: Date;

  @ApiProperty({
    description: 'Processing status',
    example: 'completed'
  })
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';

  @ApiProperty({
    description: 'Any additional metadata extracted during upload',
    example: { width: 1920, height: 1080 }
  })
  metadata?: Record<string, any>;
}

export class BulkUploadDto {
  @ApiProperty({
    description: 'Array of file upload configurations',
    type: [UploadFileDto]
  })
  files: UploadFileDto[];

  @ApiProperty({
    description: 'Common purpose for all files',
    enum: FilePurpose,
    required: false
  })
  @IsOptional()
  @IsEnum(FilePurpose)
  commonPurpose?: FilePurpose;

  @ApiProperty({
    description: 'Common tags for all files',
    type: [String],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commonTags?: string[];
}

export class BulkUploadResponseDto {
  @ApiProperty({
    description: 'Successfully uploaded files',
    type: [FileUploadResponseDto]
  })
  successful: FileUploadResponseDto[];

  @ApiProperty({
    description: 'Failed uploads with error details',
    example: [{ filename: 'invalid.txt', error: 'Unsupported file type' }]
  })
  failed: Array<{
    filename: string;
    error: string;
    details?: any;
  }>;

  @ApiProperty({
    description: 'Total files processed',
    example: 5
  })
  totalFiles: number;

  @ApiProperty({
    description: 'Number of successful uploads',
    example: 4
  })
  successCount: number;

  @ApiProperty({
    description: 'Number of failed uploads',
    example: 1
  })
  failureCount: number;
}
