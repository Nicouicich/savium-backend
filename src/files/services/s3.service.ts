import {
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  HeadObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
  ServerSideEncryption
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as path from 'path';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { FileType } from '../schemas/file-metadata.schema';

export interface S3UploadOptions {
  fileId?: string;
  userId: string;
  accountId: string;
  purpose: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  isPrivate?: boolean;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface S3UploadResult {
  fileId: string;
  bucketName: string;
  s3Key: string;
  etag: string;
  url?: string;
  cdnUrl?: string;
  checksum?: string;
}

export interface S3PresignedUrlOptions {
  expiresIn?: number; // seconds
  responseContentType?: string;
  responseContentDisposition?: string;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly cdnDomain?: string;
  private readonly publicRead: boolean;
  private readonly encryptionEnabled: boolean;
  private readonly encryptionAlgorithm: ServerSideEncryption;
  private readonly kmsKeyId?: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(private readonly configService: ConfigService) {
    const awsConfig = this.configService.get('aws');

    this.region = awsConfig.region;
    this.bucketName = awsConfig.s3.bucketName;
    this.cdnDomain = awsConfig.s3.cdnDomain;
    this.publicRead = awsConfig.s3.publicRead;
    this.encryptionEnabled = awsConfig.s3.encryption.enabled;
    this.encryptionAlgorithm = awsConfig.s3.encryption.algorithm as ServerSideEncryption;
    this.kmsKeyId = awsConfig.s3.encryption.kmsKeyId;
    this.maxFileSize = awsConfig.s3.maxFileSize;
    this.allowedMimeTypes = awsConfig.s3.allowedMimeTypes;

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey
      },
      endpoint: awsConfig.s3.endpoint,
      forcePathStyle: awsConfig.s3.forcePathStyle
    });

    this.logger.log('S3 Service initialized', {
      region: this.region,
      bucket: this.bucketName,
      encryption: this.encryptionEnabled,
      maxFileSize: this.maxFileSize,
      allowedTypes: this.allowedMimeTypes.length
    });
  }

  /**
   * Validate file before upload
   */
  validateFile(mimeType: string, fileSize: number): { valid: boolean; error?: string } {
    if (!this.allowedMimeTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `File type ${mimeType} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`
      };
    }

    if (fileSize > this.maxFileSize) {
      return {
        valid: false,
        error: `File size ${fileSize} bytes exceeds maximum allowed size of ${this.maxFileSize} bytes`
      };
    }

    return { valid: true };
  }

  /**
   * Generate S3 key for file organization
   */
  generateS3Key(options: S3UploadOptions): string {
    const fileId = options.fileId || uuidv4();
    const ext = path.extname(options.fileName);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Organize files by: uploads/users/{userId}/{purpose}/{year}/{month}/{fileId}.{ext}
    return `uploads/users/${options.userId}/${options.purpose}/${year}/${month}/${fileId}${ext}`;
  }

  /**
   * Upload file buffer to S3
   */
  async uploadBuffer(buffer: Buffer, options: S3UploadOptions): Promise<S3UploadResult> {
    const validation = this.validateFile(options.mimeType, options.fileSize);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const fileId = options.fileId || uuidv4();
    const s3Key = this.generateS3Key({ ...options, fileId });
    const checksum = this.calculateChecksum(buffer);

    try {
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: options.mimeType,
        ContentLength: options.fileSize,
        Metadata: {
          'file-id': fileId,
          'user-id': options.userId,
          'account-id': options.accountId,
          purpose: options.purpose,
          'original-name': options.fileName,
          checksum: checksum,
          ...options.metadata
        },
        TagSet: this.formatTags({
          FileId: fileId,
          UserId: options.userId,
          AccountId: options.accountId,
          Purpose: options.purpose,
          UploadedAt: new Date().toISOString(),
          ...options.tags
        }),
        ...(this.publicRead ? { ACL: ObjectCannedACL.public_read } : {}),
        ...(this.encryptionEnabled
          ? {
            ServerSideEncryption: this.encryptionAlgorithm,
            ...(this.kmsKeyId && this.encryptionAlgorithm === ServerSideEncryption.aws_kms ? { SSEKMSKeyId: this.kmsKeyId } : {})
          }
          : {})
      };

      this.logger.debug('Uploading file to S3', {
        fileId,
        s3Key,
        size: options.fileSize,
        mimeType: options.mimeType
      });

      const command = new PutObjectCommand(uploadParams);
      const result = await this.s3Client.send(command);

      const uploadResult: S3UploadResult = {
        fileId,
        bucketName: this.bucketName,
        s3Key,
        etag: result.ETag?.replace(/"/g, '') || '',
        checksum
      };

      // Generate URLs
      if (this.publicRead) {
        uploadResult.url = this.getPublicUrl(s3Key);
        if (this.cdnDomain) {
          uploadResult.cdnUrl = this.getCdnUrl(s3Key);
        }
      }

      this.logger.log('File uploaded successfully to S3', {
        fileId,
        s3Key,
        etag: uploadResult.etag
      });

      return uploadResult;
    } catch (error) {
      this.logger.error('Failed to upload file to S3', {
        fileId,
        s3Key,
        error: error.message
      });
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Upload file stream to S3 (for large files)
   */
  async uploadStream(stream: Readable, options: S3UploadOptions): Promise<S3UploadResult> {
    const validation = this.validateFile(options.mimeType, options.fileSize);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const fileId = options.fileId || uuidv4();
    const s3Key = this.generateS3Key({ ...options, fileId });

    try {
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: stream,
        ContentType: options.mimeType,
        Metadata: {
          'file-id': fileId,
          'user-id': options.userId,
          'account-id': options.accountId,
          purpose: options.purpose,
          'original-name': options.fileName,
          ...options.metadata
        },
        ...(this.publicRead ? { ACL: ObjectCannedACL.public_read } : {}),
        ...(this.encryptionEnabled
          ? {
            ServerSideEncryption: this.encryptionAlgorithm,
            ...(this.kmsKeyId && this.encryptionAlgorithm === ServerSideEncryption.aws_kms ? { SSEKMSKeyId: this.kmsKeyId } : {})
          }
          : {})
      };

      this.logger.debug('Uploading stream to S3', {
        fileId,
        s3Key,
        mimeType: options.mimeType
      });

      const upload = new Upload({
        client: this.s3Client,
        params: uploadParams,
        queueSize: 4,
        partSize: 1024 * 1024 * 5, // 5MB chunks
        leavePartsOnError: false
      });

      const result = await upload.done();

      const uploadResult: S3UploadResult = {
        fileId,
        bucketName: this.bucketName,
        s3Key,
        etag: result.ETag?.replace(/"/g, '') || ''
      };

      // Generate URLs
      if (this.publicRead) {
        uploadResult.url = this.getPublicUrl(s3Key);
        if (this.cdnDomain) {
          uploadResult.cdnUrl = this.getCdnUrl(s3Key);
        }
      }

      this.logger.log('Stream uploaded successfully to S3', {
        fileId,
        s3Key,
        etag: uploadResult.etag
      });

      return uploadResult;
    } catch (error) {
      this.logger.error('Failed to upload stream to S3', {
        fileId,
        s3Key,
        error: error.message
      });
      throw new Error(`S3 stream upload failed: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for file access
   */
  async generatePresignedUrl(s3Key: string, options: S3PresignedUrlOptions = {}): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ResponseContentType: options.responseContentType,
        ResponseContentDisposition: options.responseContentDisposition
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: options.expiresIn || 3600 // 1 hour default
      });

      this.logger.debug('Generated presigned URL', {
        s3Key,
        expiresIn: options.expiresIn || 3600
      });

      return url;
    } catch (error) {
      this.logger.error('Failed to generate presigned URL', {
        s3Key,
        error: error.message
      });
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Download file from S3
   */
  async downloadFile(s3Key: string): Promise<GetObjectCommandOutput> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const result = await this.s3Client.send(command);

      this.logger.debug('File downloaded from S3', { s3Key });

      return result;
    } catch (error) {
      this.logger.error('Failed to download file from S3', {
        s3Key,
        error: error.message
      });
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(s3Key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(s3Key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      await this.s3Client.send(command);

      this.logger.log('File deleted from S3', { s3Key });
    } catch (error) {
      this.logger.error('Failed to delete file from S3', {
        s3Key,
        error: error.message
      });
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  /**
   * Get public URL for file
   */
  getPublicUrl(s3Key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
  }

  /**
   * Get CDN URL for file
   */
  getCdnUrl(s3Key: string): string {
    if (!this.cdnDomain) {
      return this.getPublicUrl(s3Key);
    }
    return `${this.cdnDomain}/${s3Key}`;
  }

  /**
   * Determine file type from MIME type
   */
  getFileTypeFromMime(mimeType: string): FileType {
    if (mimeType.startsWith('image/')) {
      return FileType.IMAGE;
    } else if (mimeType.startsWith('audio/')) {
      return FileType.AUDIO;
    } else if (mimeType.startsWith('video/')) {
      return FileType.VIDEO;
    } else {
      return FileType.DOCUMENT;
    }
  }

  /**
   * Format tags for S3
   */
  private formatTags(tags: Record<string, string>): Array<{ Key: string; Value: string }> {
    return Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
  }

  /**
   * Calculate file checksum
   */
  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Get service status and configuration
   */
  getServiceStatus(): {
    enabled: boolean;
    configuration: Record<string, any>;
    features: string[];
    limitations: string[];
  } {
    const isConfigured = !!(this.bucketName && this.region);

    return {
      enabled: isConfigured,
      configuration: {
        region: this.region,
        bucketName: this.bucketName,
        hasCdnDomain: !!this.cdnDomain,
        publicRead: this.publicRead,
        encryption: this.encryptionEnabled,
        maxFileSize: this.maxFileSize,
        allowedTypes: this.allowedMimeTypes.length
      },
      features: isConfigured
        ? [
          'File upload to S3',
          'Stream upload for large files',
          'Presigned URL generation',
          'File validation and organization',
          'Metadata and tagging support',
          'Checksum verification',
          ...(this.encryptionEnabled ? ['Server-side encryption'] : []),
          ...(this.cdnDomain ? ['CDN integration'] : [])
        ]
        : [],
      limitations: isConfigured
        ? [`Max file size: ${(this.maxFileSize / 1024 / 1024).toFixed(0)}MB`, `Allowed types: ${this.allowedMimeTypes.length} MIME types`]
        : ['AWS S3 credentials not configured', 'Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME in .env']
    };
  }
}
