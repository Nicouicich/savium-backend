import { ApiProperty } from '@nestjs/swagger';
import { FileType, FilePurpose, FileStatus } from '../schemas/file-metadata.schema';

export class FileMetadataResponseDto {
  @ApiProperty({
    description: 'Unique file identifier',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  fileId: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'receipt_coffee_shop.jpg'
  })
  originalName: string;

  @ApiProperty({
    description: 'File extension',
    example: 'jpg'
  })
  extension: string;

  @ApiProperty({
    description: 'MIME type',
    example: 'image/jpeg'
  })
  mimeType: string;

  @ApiProperty({
    description: 'File type category',
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
    description: 'File purpose',
    enum: FilePurpose,
    example: FilePurpose.RECEIPT
  })
  purpose: FilePurpose;

  @ApiProperty({
    description: 'File status',
    enum: FileStatus,
    example: FileStatus.ACTIVE
  })
  status: FileStatus;

  @ApiProperty({
    description: 'User who uploaded the file',
    example: '507f1f77bcf86cd799439011'
  })
  uploadedBy: string;

  @ApiProperty({
    description: 'Account associated with the file',
    example: '507f1f77bcf86cd799439012'
  })
  accountId: string;

  @ApiProperty({
    description: 'Upload source',
    example: 'whatsapp'
  })
  uploadSource: string;

  @ApiProperty({
    description: 'S3 object key for the file',
    example: 'uploads/users/123/receipts/2024/01/uuid-filename.jpg'
  })
  s3Key: string;

  @ApiProperty({
    description: 'File URL (if accessible)',
    example: 'https://savium-uploads.s3.amazonaws.com/uploads/users/123/receipts/2024/01/file.jpg'
  })
  url?: string;

  @ApiProperty({
    description: 'CDN URL if available',
    example: 'https://cdn.savium.com/uploads/users/123/receipts/2024/01/file.jpg'
  })
  cdnUrl?: string;

  @ApiProperty({
    description: 'File tags',
    example: ['receipt', 'business', 'restaurant']
  })
  tags: string[];

  @ApiProperty({
    description: 'File description',
    example: 'Receipt from business lunch with client'
  })
  description?: string;

  @ApiProperty({
    description: 'Is file marked as private',
    example: false
  })
  isPrivate: boolean;

  @ApiProperty({
    description: 'File metadata',
    example: { width: 1920, height: 1080, extractedText: 'Total: $25.99' }
  })
  metadata: Record<string, any>;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2024-01-01T00:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T12:00:00.000Z'
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Last access timestamp',
    example: '2024-01-01T12:00:00.000Z'
  })
  lastAccessedAt: Date;

  @ApiProperty({
    description: 'Access count',
    example: 5
  })
  accessCount: number;
}

export class FileListResponseDto {
  @ApiProperty({
    description: 'Array of file metadata',
    type: [FileMetadataResponseDto]
  })
  files: FileMetadataResponseDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 20,
      total: 150,
      pages: 8,
      hasNext: true,
      hasPrev: false
    }
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class FileStatsResponseDto {
  @ApiProperty({
    description: 'Total number of files',
    example: 150
  })
  totalFiles: number;

  @ApiProperty({
    description: 'Total storage used in bytes',
    example: 157286400
  })
  totalSize: number;

  @ApiProperty({
    description: 'Total storage used (human readable)',
    example: '150.0 MB'
  })
  totalSizeFormatted: string;

  @ApiProperty({
    description: 'Files by type breakdown',
    example: {
      image: 120,
      document: 25,
      audio: 5
    }
  })
  filesByType: Record<string, number>;

  @ApiProperty({
    description: 'Files by purpose breakdown',
    example: {
      receipt: 80,
      invoice: 30,
      general: 40
    }
  })
  filesByPurpose: Record<string, number>;

  @ApiProperty({
    description: 'Files by upload source',
    example: {
      web: 90,
      whatsapp: 40,
      telegram: 20
    }
  })
  filesBySource: Record<string, number>;

  @ApiProperty({
    description: 'Upload trends by period',
    example: [
      { period: '2024-01', count: 45, size: 52428800 },
      { period: '2024-02', count: 38, size: 41943040 }
    ]
  })
  uploadTrends: Array<{
    period: string;
    count: number;
    size: number;
  }>;

  @ApiProperty({
    description: 'Average file size in bytes',
    example: 1048576
  })
  averageFileSize: number;

  @ApiProperty({
    description: 'Most common tags',
    example: [
      { tag: 'receipt', count: 80 },
      { tag: 'business', count: 45 },
      { tag: 'restaurant', count: 30 }
    ]
  })
  popularTags: Array<{
    tag: string;
    count: number;
  }>;
}

export class PresignedUrlResponseDto {
  @ApiProperty({
    description: 'Presigned URL for file access',
    example: 'https://savium-uploads.s3.amazonaws.com/uploads/users/123/receipts/2024/01/file.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&...'
  })
  url: string;

  @ApiProperty({
    description: 'URL expiration timestamp',
    example: '2024-01-01T01:00:00.000Z'
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'File metadata',
    type: FileMetadataResponseDto
  })
  fileMetadata: FileMetadataResponseDto;
}

export class FileProcessingResponseDto {
  @ApiProperty({
    description: 'File ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  fileId: string;

  @ApiProperty({
    description: 'Processing status',
    example: 'completed'
  })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @ApiProperty({
    description: 'Extracted data from file processing',
    example: {
      extractedText: 'Coffee Shop Receipt\nTotal: $25.99\nDate: 2024-01-01',
      detectedLanguage: 'en',
      confidence: 0.95,
      extractedData: {
        total: 25.99,
        vendor: 'Coffee Shop',
        date: '2024-01-01'
      }
    }
  })
  extractedData?: Record<string, any>;

  @ApiProperty({
    description: 'Processing error details if failed',
    example: 'Unable to extract text from corrupted image'
  })
  error?: string;

  @ApiProperty({
    description: 'Processing completion timestamp',
    example: '2024-01-01T00:01:30.000Z'
  })
  processedAt?: Date;
}
