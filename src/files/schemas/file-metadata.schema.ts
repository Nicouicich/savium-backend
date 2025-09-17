import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type FileMetadataDocument = FileMetadata & Document;

export enum FileType {
  IMAGE = 'image',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  VIDEO = 'video'
}

export enum FilePurpose {
  RECEIPT = 'receipt',
  INVOICE = 'invoice',
  STATEMENT = 'statement',
  PROOF_OF_PAYMENT = 'proof_of_payment',
  CONTRACT = 'contract',
  PROFILE_PHOTO = 'profile_photo',
  GENERAL = 'general'
}

export enum FileStatus {
  UPLOADING = 'uploading',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

@Schema({
  timestamps: true,
  collection: 'file_metadata'
})
export class FileMetadata {
  @ApiProperty({
    description: 'Unique file identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true
  })
  fileId: string;

  @ApiProperty({
    description: 'Original filename as uploaded',
    example: 'receipt_coffee_shop.jpg'
  })
  @Prop({
    type: String,
    required: true,
    trim: true
  })
  originalName: string;

  @ApiProperty({
    description: 'File extension without dot',
    example: 'jpg'
  })
  @Prop({
    type: String,
    required: true,
    lowercase: true
  })
  extension: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/jpeg'
  })
  @Prop({
    type: String,
    required: true
  })
  mimeType: string;

  @ApiProperty({
    description: 'File type category',
    enum: FileType,
    example: FileType.IMAGE
  })
  @Prop({
    type: String,
    enum: Object.values(FileType),
    required: true,
    index: true
  })
  fileType: FileType;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576
  })
  @Prop({
    type: Number,
    required: true,
    min: 0
  })
  size: number;

  @ApiProperty({
    description: 'S3 bucket name',
    example: 'savium-uploads'
  })
  @Prop({
    type: String,
    required: true
  })
  bucketName: string;

  @ApiProperty({
    description: 'S3 object key/path',
    example: 'uploads/users/123/receipts/2024/01/550e8400-e29b-41d4-a716-446655440000.jpg'
  })
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true
  })
  s3Key: string;

  @ApiProperty({
    description: 'S3 ETag (checksum)',
    example: 'd41d8cd98f00b204e9800998ecf8427e'
  })
  @Prop({
    type: String
  })
  etag?: string;

  @ApiProperty({
    description: 'Direct S3 URL (if public)',
    example: 'https://savium-uploads.s3.amazonaws.com/uploads/users/123/receipts/2024/01/file.jpg'
  })
  @Prop({
    type: String
  })
  url?: string;

  @ApiProperty({
    description: 'CDN URL if available',
    example: 'https://cdn.savium.com/uploads/users/123/receipts/2024/01/file.jpg'
  })
  @Prop({
    type: String
  })
  cdnUrl?: string;

  @ApiProperty({
    description: 'Purpose/category of the file',
    enum: FilePurpose,
    example: FilePurpose.RECEIPT
  })
  @Prop({
    type: String,
    enum: Object.values(FilePurpose),
    default: FilePurpose.GENERAL,
    index: true
  })
  purpose: FilePurpose;

  @ApiProperty({
    description: 'Current status of the file',
    enum: FileStatus,
    example: FileStatus.ACTIVE
  })
  @Prop({
    type: String,
    enum: Object.values(FileStatus),
    default: FileStatus.ACTIVE,
    index: true
  })
  status: FileStatus;

  @ApiProperty({
    description: 'User who uploaded the file',
    example: '507f1f77bcf86cd799439011'
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  })
  uploadedBy: Types.ObjectId;

  @ApiProperty({
    description: 'Account context for the file',
    example: '507f1f77bcf86cd799439012'
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  })
  accountId: Types.ObjectId;

  @ApiProperty({
    description: 'Platform/source of upload',
    example: 'whatsapp'
  })
  @Prop({
    type: String,
    enum: ['web', 'mobile', 'whatsapp', 'telegram', 'api'],
    default: 'web'
  })
  uploadSource: string;

  @ApiProperty({
    description: 'Additional metadata extracted from file',
    example: { width: 1920, height: 1080, pages: 1, duration: 30 }
  })
  @Prop({
    type: Object,
    default: {}
  })
  metadata: {
    // Image metadata
    width?: number;
    height?: number;

    // Audio metadata
    duration?: number;
    bitrate?: number;

    // Document metadata
    pages?: number;

    // AI-extracted data
    extractedText?: string;
    detectedLanguage?: string;
    confidence?: number;

    // Processing flags
    processed?: boolean;
    processingError?: string;

    // Custom metadata
    [key: string]: any;
  };

  @ApiProperty({
    description: 'File tags for organization',
    example: ['receipt', 'restaurant', 'business_expense']
  })
  @Prop({
    type: [String],
    default: [],
    index: true
  })
  tags: string[];

  @ApiProperty({
    description: 'File description or notes',
    example: 'Coffee shop receipt from client meeting'
  })
  @Prop({
    type: String,
    trim: true
  })
  description?: string;

  @ApiProperty({
    description: 'Whether file is marked as sensitive/private',
    example: false
  })
  @Prop({
    type: Boolean,
    default: false,
    index: true
  })
  isPrivate: boolean;

  @ApiProperty({
    description: 'S3 storage class',
    example: 'STANDARD'
  })
  @Prop({
    type: String,
    default: 'STANDARD'
  })
  storageClass: string;

  @ApiProperty({
    description: 'File encryption information',
    example: { encrypted: true, algorithm: 'AES256' }
  })
  @Prop({
    type: Object
  })
  encryption?: {
    encrypted: boolean;
    algorithm?: string;
    keyId?: string;
  };

  @ApiProperty({
    description: 'File expiration date (for automatic cleanup)',
    example: '2031-01-01T00:00:00.000Z'
  })
  @Prop({
    type: Date,
    index: true
  })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Date when file was soft-deleted',
    example: '2024-01-01T00:00:00.000Z'
  })
  @Prop({
    type: Date
  })
  deletedAt?: Date;

  @ApiProperty({
    description: 'User who deleted the file',
    example: '507f1f77bcf86cd799439011'
  })
  @Prop({
    type: Types.ObjectId,
    ref: 'User'
  })
  deletedBy?: Types.ObjectId;

  @ApiProperty({
    description: 'Last access timestamp for usage analytics',
    example: '2024-01-01T00:00:00.000Z'
  })
  @Prop({
    type: Date,
    default: Date.now
  })
  lastAccessedAt: Date;

  @ApiProperty({
    description: 'Number of times file was accessed',
    example: 5
  })
  @Prop({
    type: Number,
    default: 0
  })
  accessCount: number;

  @ApiProperty({
    description: 'File checksum for integrity verification',
    example: 'sha256:d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2'
  })
  @Prop({
    type: String
  })
  checksum?: string;

  // Timestamps (from @nestjs/mongoose)
  createdAt?: Date;
  updatedAt?: Date;
}

export const FileMetadataSchema = SchemaFactory.createForClass(FileMetadata);

// Create compound indexes for efficient queries
FileMetadataSchema.index({ accountId: 1, fileType: 1, status: 1 });
FileMetadataSchema.index({ uploadedBy: 1, createdAt: -1 });
FileMetadataSchema.index({ purpose: 1, createdAt: -1 });
FileMetadataSchema.index({ tags: 1 });
FileMetadataSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { expiresAt: { $exists: true } }
  }
);

// Text search index for metadata
FileMetadataSchema.index({
  originalName: 'text',
  description: 'text',
  'metadata.extractedText': 'text',
  tags: 'text'
});

// Pre-save middleware to update lastAccessedAt when accessed
FileMetadataSchema.pre('findOne', function () {
  this.updateOne({}, { $inc: { accessCount: 1 }, $set: { lastAccessedAt: new Date() } });
});

FileMetadataSchema.pre('find', function () {
  // Only apply to non-deleted files by default
  if (!this.getQuery().status && !this.getQuery().deletedAt) {
    this.where({ status: { $ne: FileStatus.DELETED } });
  }
});
