import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { Readable } from 'stream';

import { FileMetadata, FileMetadataDocument, FileType, FilePurpose, FileStatus } from '../schemas/file-metadata.schema';
import { S3Service, S3UploadOptions } from './s3.service';
import { UploadFileDto, FileUploadResponseDto, BulkUploadResponseDto } from '../dto/upload-file.dto';
import { FileQueryDto, FileStatsDto } from '../dto/file-query.dto';
import { FileMetadataResponseDto, FileListResponseDto, FileStatsResponseDto, PresignedUrlResponseDto } from '../dto/file-response.dto';

export interface UploadFileRequest {
  buffer?: Buffer;
  stream?: Readable;
  originalName: string;
  mimeType: string;
  size: number;
  uploadDto: UploadFileDto;
  userId: string;
  accountId: string;
  traceId?: string;
}

@Injectable()
export class FileManagementService {
  private readonly logger = new Logger(FileManagementService.name);

  constructor(
    @InjectModel(FileMetadata.name)
    private readonly fileMetadataModel: Model<FileMetadataDocument>,
    private readonly s3Service: S3Service
  ) {}

  /**
   * Upload a single file
   */
  async uploadFile(request: UploadFileRequest): Promise<FileUploadResponseDto> {
    const { buffer, stream, originalName, mimeType, size, uploadDto, userId, accountId, traceId } = request;

    if (!buffer && !stream) {
      throw new BadRequestException('Either buffer or stream must be provided');
    }

    this.logger.log('Starting file upload', {
      traceId,
      originalName,
      mimeType,
      size,
      userId,
      accountId,
      purpose: uploadDto.purpose
    });

    try {
      // Generate unique file ID
      const fileId = uuidv4();
      const extension = path.extname(originalName).toLowerCase().substring(1);
      const fileType = this.s3Service.getFileTypeFromMime(mimeType);

      // Prepare S3 upload options
      const s3Options: S3UploadOptions = {
        fileId,
        userId,
        accountId: uploadDto.accountId || accountId,
        purpose: uploadDto.purpose || FilePurpose.GENERAL,
        fileName: originalName,
        mimeType,
        fileSize: size,
        isPrivate: uploadDto.isPrivate,
        metadata: {
          'trace-id': traceId || '',
          'upload-source': uploadDto.uploadSource || 'web',
          description: uploadDto.description || '',
          tags: uploadDto.tags?.join(',') || '',
          ...uploadDto.metadata
        }
      };

      // Upload to S3
      let s3Result;
      if (buffer) {
        s3Result = await this.s3Service.uploadBuffer(buffer, s3Options);
      } else {
        s3Result = await this.s3Service.uploadStream(stream!, s3Options);
      }

      // Extract additional metadata based on file type
      const extractedMetadata = await this.extractFileMetadata(buffer, fileType, mimeType);

      // Save metadata to database
      const fileMetadata = new this.fileMetadataModel({
        fileId,
        originalName,
        extension,
        mimeType,
        fileType,
        size,
        bucketName: s3Result.bucketName,
        s3Key: s3Result.s3Key,
        etag: s3Result.etag,
        url: s3Result.url,
        cdnUrl: s3Result.cdnUrl,
        purpose: uploadDto.purpose || FilePurpose.GENERAL,
        uploadedBy: userId,
        accountId: new Types.ObjectId(uploadDto.accountId || accountId),
        uploadSource: uploadDto.uploadSource || 'web',
        metadata: {
          ...extractedMetadata,
          ...uploadDto.metadata
        },
        tags: uploadDto.tags || [],
        description: uploadDto.description,
        isPrivate: uploadDto.isPrivate || false,
        checksum: s3Result.checksum,
        status: FileStatus.ACTIVE,
        lastAccessedAt: new Date()
      });

      const savedMetadata = await fileMetadata.save();

      this.logger.log('File uploaded successfully', {
        traceId,
        fileId,
        s3Key: s3Result.s3Key,
        dbId: savedMetadata._id
      });

      return {
        fileId,
        originalName,
        fileType,
        size,
        s3Key: s3Result.s3Key,
        url: s3Result.url,
        cdnUrl: s3Result.cdnUrl,
        uploadedAt: savedMetadata.createdAt!,
        processingStatus: 'completed',
        metadata: extractedMetadata
      };
    } catch (error) {
      this.logger.error('File upload failed', {
        traceId,
        originalName,
        error: error.message,
        stack: error.stack
      });

      throw new BadRequestException(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(requests: UploadFileRequest[]): Promise<BulkUploadResponseDto> {
    const successful: FileUploadResponseDto[] = [];
    const failed: Array<{ filename: string; error: string; details?: any }> = [];

    for (const request of requests) {
      try {
        const result = await this.uploadFile(request);
        successful.push(result);
      } catch (error) {
        failed.push({
          filename: request.originalName,
          error: error.message,
          details: error.response || error
        });
      }
    }

    return {
      successful,
      failed,
      totalFiles: requests.length,
      successCount: successful.length,
      failureCount: failed.length
    };
  }

  /**
   * Get file metadata by ID
   */
  async getFileById(fileId: string, userId: string, accountId?: string): Promise<FileMetadataResponseDto> {
    const file = await this.fileMetadataModel.findOne({ fileId, status: { $ne: FileStatus.DELETED } }).exec();

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    // Check access permissions
    this.checkFileAccess(file, userId, accountId);

    // Update access tracking
    await this.fileMetadataModel.updateOne(
      { _id: file._id },
      {
        $inc: { accessCount: 1 },
        $set: { lastAccessedAt: new Date() }
      }
    );

    return this.mapToResponseDto(file);
  }

  /**
   * List files with pagination and filtering
   */
  async listFiles(query: FileQueryDto, userId: string, accountId?: string): Promise<FileListResponseDto> {
    // Build filter query
    const filter: any = {
      status: query.includeDeleted ? undefined : { $ne: FileStatus.DELETED }
    };

    // Apply access control
    if (accountId) {
      filter.accountId = new Types.ObjectId(accountId);
    } else {
      filter.uploadedBy = userId;
    }

    // Apply filters
    if (query.fileType) filter.fileType = query.fileType;
    if (query.purpose) filter.purpose = query.purpose;
    if (query.status) filter.status = query.status;
    if (query.uploadSource) filter.uploadSource = query.uploadSource;
    if (query.isPrivate !== undefined) filter.isPrivate = query.isPrivate;
    if (query.tags?.length) filter.tags = { $in: query.tags };

    // Date range filter
    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
    }

    // Size range filter
    if (query.minSize !== undefined || query.maxSize !== undefined) {
      filter.size = {};
      if (query.minSize !== undefined) filter.size.$gte = query.minSize;
      if (query.maxSize !== undefined) filter.size.$lte = query.maxSize;
    }

    // Text search
    if (query.search) {
      filter.$text = { $search: query.search };
    }

    // Build sort
    const sort: any = {};
    sort[query.sortBy!] = query.sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const [files, total] = await Promise.all([
      this.fileMetadataModel
        .find(filter)
        .sort(sort)
        .skip((query.page! - 1) * query.limit!)
        .limit(query.limit!)
        .exec(),
      this.fileMetadataModel.countDocuments(filter)
    ]);

    const pages = Math.ceil(total / query.limit!);

    return {
      files: files.map(file => this.mapToResponseDto(file)),
      pagination: {
        page: query.page!,
        limit: query.limit!,
        total,
        pages,
        hasNext: query.page! < pages,
        hasPrev: query.page! > 1
      }
    };
  }

  /**
   * Generate presigned URL for file access
   */
  async generatePresignedUrl(fileId: string, userId: string, accountId?: string, expiresIn: number = 3600): Promise<PresignedUrlResponseDto> {
    const file = await this.getFileById(fileId, userId, accountId);

    const url = await this.s3Service.generatePresignedUrl(file.s3Key, {
      expiresIn,
      responseContentType: file.mimeType,
      responseContentDisposition: `attachment; filename="${file.originalName}"`
    });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      fileMetadata: file
    };
  }

  /**
   * Delete file (soft delete)
   */
  async deleteFile(fileId: string, userId: string, accountId?: string): Promise<void> {
    const file = await this.fileMetadataModel.findOne({ fileId, status: { $ne: FileStatus.DELETED } }).exec();

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    this.checkFileAccess(file, userId, accountId);

    // Soft delete
    await this.fileMetadataModel.updateOne(
      { _id: file._id },
      {
        $set: {
          status: FileStatus.DELETED,
          deletedAt: new Date(),
          deletedBy: userId
        }
      }
    );

    this.logger.log('File soft deleted', {
      fileId,
      s3Key: file.s3Key,
      deletedBy: userId
    });
  }

  /**
   * Permanently delete file (remove from S3 and database)
   */
  async permanentlyDeleteFile(fileId: string, userId: string, accountId?: string): Promise<void> {
    const file = await this.fileMetadataModel.findOne({ fileId }).exec();

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    this.checkFileAccess(file, userId, accountId);

    try {
      // Delete from S3
      await this.s3Service.deleteFile(file.s3Key);

      // Delete from database
      await this.fileMetadataModel.deleteOne({ _id: file._id });

      this.logger.log('File permanently deleted', {
        fileId,
        s3Key: file.s3Key,
        deletedBy: userId
      });
    } catch (error) {
      this.logger.error('Failed to permanently delete file', {
        fileId,
        s3Key: file.s3Key,
        error: error.message
      });
      throw new BadRequestException(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get file statistics
   */
  async getFileStats(query: FileStatsDto, userId: string, accountId?: string): Promise<FileStatsResponseDto> {
    // Build base filter
    const baseFilter: any = {
      status: { $ne: FileStatus.DELETED }
    };

    if (accountId) {
      baseFilter.accountId = new Types.ObjectId(accountId);
    } else if (query.userId) {
      baseFilter.uploadedBy = new Types.ObjectId(query.userId);
    } else {
      baseFilter.uploadedBy = userId;
    }

    // Date range filter
    if (query.dateFrom || query.dateTo) {
      baseFilter.createdAt = {};
      if (query.dateFrom) baseFilter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) baseFilter.createdAt.$lte = new Date(query.dateTo);
    }

    // Execute aggregation pipelines
    const [totalStats, typeStats, purposeStats, sourceStats, tagStats] = await Promise.all([
      this.getTotalStats(baseFilter),
      this.getFilesByType(baseFilter),
      this.getFilesByPurpose(baseFilter),
      this.getFilesBySource(baseFilter),
      this.getPopularTags(baseFilter)
    ]);

    // Get upload trends if groupBy is specified
    let uploadTrends: any[] = [];
    if (query.groupBy) {
      uploadTrends = await this.getUploadTrends(baseFilter, query.groupBy);
    }

    return {
      totalFiles: totalStats.count,
      totalSize: totalStats.size,
      totalSizeFormatted: this.formatFileSize(totalStats.size),
      filesByType: typeStats,
      filesByPurpose: purposeStats,
      filesBySource: sourceStats,
      uploadTrends,
      averageFileSize: totalStats.count > 0 ? Math.round(totalStats.size / totalStats.count) : 0,
      popularTags: tagStats
    };
  }

  /**
   * Update file metadata
   */
  async updateFileMetadata(
    fileId: string,
    updates: Partial<{
      description: string;
      tags: string[];
      purpose: FilePurpose;
      isPrivate: boolean;
      metadata: Record<string, any>;
    }>,
    userId: string,
    accountId?: string
  ): Promise<FileMetadataResponseDto> {
    const file = await this.fileMetadataModel.findOne({ fileId, status: { $ne: FileStatus.DELETED } }).exec();

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    this.checkFileAccess(file, userId, accountId);

    const updatedFile = await this.fileMetadataModel.findByIdAndUpdate(file._id, { $set: updates }, { new: true }).exec();

    this.logger.log('File metadata updated', {
      fileId,
      updates: Object.keys(updates),
      updatedBy: userId
    });

    return this.mapToResponseDto(updatedFile!);
  }

  /**
   * Helper method to check file access permissions
   */
  private checkFileAccess(file: FileMetadataDocument, userId: string, accountId?: string): void {
    const isOwner = file.uploadedBy.toString() === userId;
    const isAccountMember = accountId && file.accountId.toString() === accountId;

    if (!isOwner && !isAccountMember) {
      throw new ForbiddenException('You do not have permission to access this file');
    }
  }

  /**
   * Extract metadata from file based on type
   */
  private async extractFileMetadata(buffer?: Buffer, fileType?: FileType, mimeType?: string): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};

    if (!buffer || !fileType) {
      return metadata;
    }

    try {
      switch (fileType) {
        case FileType.IMAGE:
          // For images, you might want to use a library like 'sharp' to extract dimensions
          // metadata.width = ...
          // metadata.height = ...
          metadata.processed = false;
          break;

        case FileType.AUDIO:
          // For audio files, you might want to use libraries like 'node-ffmpeg' or 'musicmetadata'
          // metadata.duration = ...
          // metadata.bitrate = ...
          metadata.processed = false;
          break;

        case FileType.DOCUMENT:
          // For documents, you might want to use libraries to extract text or page counts
          // metadata.pages = ...
          metadata.processed = false;
          break;

        default:
          metadata.processed = false;
      }
    } catch (error) {
      this.logger.warn('Failed to extract file metadata', {
        fileType,
        mimeType,
        error: error.message
      });
      metadata.processingError = error.message;
    }

    return metadata;
  }

  /**
   * Map database document to response DTO
   */
  private mapToResponseDto(file: FileMetadataDocument): FileMetadataResponseDto {
    return {
      fileId: file.fileId,
      originalName: file.originalName,
      extension: file.extension,
      mimeType: file.mimeType,
      fileType: file.fileType,
      size: file.size,
      purpose: file.purpose,
      status: file.status,
      uploadedBy: file.uploadedBy.toString(),
      accountId: file.accountId.toString(),
      uploadSource: file.uploadSource,
      s3Key: file.s3Key,
      url: file.url,
      cdnUrl: file.cdnUrl,
      tags: file.tags,
      description: file.description,
      isPrivate: file.isPrivate,
      metadata: file.metadata,
      createdAt: file.createdAt!,
      updatedAt: file.updatedAt!,
      lastAccessedAt: file.lastAccessedAt,
      accessCount: file.accessCount
    };
  }

  /**
   * Aggregation helpers for statistics
   */
  private async getTotalStats(filter: any): Promise<{ count: number; size: number }> {
    const result = await this.fileMetadataModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          size: { $sum: '$size' }
        }
      }
    ]);

    return result[0] || { count: 0, size: 0 };
  }

  private async getFilesByType(filter: any): Promise<Record<string, number>> {
    const result = await this.fileMetadataModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$fileType',
          count: { $sum: 1 }
        }
      }
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  private async getFilesByPurpose(filter: any): Promise<Record<string, number>> {
    const result = await this.fileMetadataModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$purpose',
          count: { $sum: 1 }
        }
      }
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  private async getFilesBySource(filter: any): Promise<Record<string, number>> {
    const result = await this.fileMetadataModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$uploadSource',
          count: { $sum: 1 }
        }
      }
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  private async getPopularTags(filter: any): Promise<Array<{ tag: string; count: number }>> {
    const result = await this.fileMetadataModel.aggregate([
      { $match: filter },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          tag: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    return result;
  }

  private async getUploadTrends(filter: any, groupBy: string): Promise<Array<{ period: string; count: number; size: number }>> {
    let dateFormat: string;
    switch (groupBy) {
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-W%U';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'year':
        dateFormat = '%Y';
        break;
      default:
        dateFormat = '%Y-%m';
    }

    const result = await this.fileMetadataModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          count: { $sum: 1 },
          size: { $sum: '$size' }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          period: '$_id',
          count: 1,
          size: 1,
          _id: 0
        }
      }
    ]);

    return result;
  }

  /**
   * Format file size in human readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
