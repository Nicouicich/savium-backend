import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Logger,
  Param,
  ParseFilePipeBuilder,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { FileQueryDto, FileStatsDto } from './dto/file-query.dto';
import { FileListResponseDto, FileMetadataResponseDto, FileStatsResponseDto, PresignedUrlResponseDto } from './dto/file-response.dto';
import { BulkUploadDto, BulkUploadResponseDto, FileUploadResponseDto, UploadFileDto } from './dto/upload-file.dto';
import { FilePurpose, FileType } from './schemas/file-metadata.schema';
import { FileManagementService } from './services/file-management.service';
import { S3Service } from './services/s3.service';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(
    private readonly fileManagementService: FileManagementService,
    private readonly s3Service: S3Service
  ) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload a single file',
    description: 'Upload a file to S3 and store metadata in the database'
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: FileUploadResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid file or upload parameters' })
  @ApiResponse({ status: 413, description: 'File too large' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpeg|jpg|png|gif|webp|pdf|mp3|wav|ogg|mp4)$/
        })
        .addMaxSizeValidator({
          maxSize: 50 * 1024 * 1024 // 50MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY
        })
    ) file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
    @Req() req: RequestWithUser
  ): Promise<FileUploadResponseDto> {
    this.logger.log('File upload request received', {
      traceId: req.traceId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      userId: req.user.id,
      purpose: uploadDto.purpose
    });

    return this.fileManagementService.uploadFile({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadDto,
      userId: req.user.id,
      accountId: uploadDto.accountId || req.user.id,
      traceId: req.traceId
    });
  }

  @Post('upload/bulk')
  @ApiOperation({
    summary: 'Upload multiple files',
    description: 'Upload multiple files in a single request'
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Files upload completed (may include partial failures)',
    type: BulkUploadResponseDto
  })
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  async uploadFiles(
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpeg|jpg|png|gif|webp|pdf|mp3|wav|ogg|mp4)$/
        })
        .addMaxSizeValidator({
          maxSize: 50 * 1024 * 1024 // 50MB per file
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY
        })
    ) files: Express.Multer.File[],
    @Body() bulkUploadDto: BulkUploadDto,
    @Req() req: RequestWithUser
  ): Promise<BulkUploadResponseDto> {
    this.logger.log('Bulk file upload request received', {
      traceId: req.traceId,
      fileCount: files.length,
      userId: req.user.id
    });

    const uploadRequests = files.map((file, index) => ({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadDto: {
        ...bulkUploadDto.files[index],
        purpose: bulkUploadDto.files[index]?.purpose || bulkUploadDto.commonPurpose || FilePurpose.GENERAL,
        tags: [...(bulkUploadDto.files[index]?.tags || []), ...(bulkUploadDto.commonTags || [])]
      },
      userId: req.user.id,
      accountId: req.user.id,
      traceId: req.traceId
    }));

    return this.fileManagementService.uploadFiles(uploadRequests);
  }

  @Get()
  @ApiOperation({
    summary: 'List files with filtering and pagination',
    description: 'Get a paginated list of files with various filter options'
  })
  @ApiResponse({
    status: 200,
    description: 'Files retrieved successfully',
    type: FileListResponseDto
  })
  async listFiles(@Query() query: FileQueryDto, @Req() req: RequestWithUser): Promise<FileListResponseDto> {
    return this.fileManagementService.listFiles(query, req.user.id, query.accountId || req.user.id);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get file statistics',
    description: 'Get aggregated statistics about files'
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: FileStatsResponseDto
  })
  async getFileStats(@Query() query: FileStatsDto, @Req() req: RequestWithUser): Promise<FileStatsResponseDto> {
    return this.fileManagementService.getFileStats(query, req.user.id, query.accountId || req.user.id);
  }

  @Get(':fileId')
  @ApiOperation({
    summary: 'Get file metadata by ID',
    description: 'Retrieve detailed metadata for a specific file'
  })
  @ApiParam({
    name: 'fileId',
    description: 'Unique file identifier',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({
    status: 200,
    description: 'File metadata retrieved successfully',
    type: FileMetadataResponseDto
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getFileById(@Param('fileId') fileId: string, @Query('accountId') accountId: string, @Req() req: RequestWithUser): Promise<FileMetadataResponseDto> {
    return this.fileManagementService.getFileById(fileId, req.user.id, accountId || req.user.id);
  }

  @Get(':fileId/download')
  @ApiOperation({
    summary: 'Generate presigned URL for file download',
    description: 'Get a temporary URL to download the file directly from S3'
  })
  @ApiParam({
    name: 'fileId',
    description: 'Unique file identifier',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiQuery({
    name: 'expiresIn',
    description: 'URL expiration time in seconds',
    example: 3600,
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
    type: PresignedUrlResponseDto
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async generateDownloadUrl(
    @Req() req: RequestWithUser,
    @Param('fileId') fileId: string,
    @Query('expiresIn') expiresIn?: number,
    @Query('accountId') accountId?: string
  ): Promise<PresignedUrlResponseDto> {
    return this.fileManagementService.generatePresignedUrl(fileId, req.user.id, accountId || req.user.id, expiresIn || 3600);
  }

  @Put(':fileId')
  @ApiOperation({
    summary: 'Update file metadata',
    description: 'Update file description, tags, purpose, and other metadata'
  })
  @ApiParam({
    name: 'fileId',
    description: 'Unique file identifier',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({
    status: 200,
    description: 'File metadata updated successfully',
    type: FileMetadataResponseDto
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async updateFileMetadata(
    @Param('fileId') fileId: string,
    @Body() updates: Partial<UploadFileDto>,
    @Query('accountId') accountId: string,
    @Req() req: RequestWithUser
  ): Promise<FileMetadataResponseDto> {
    return this.fileManagementService.updateFileMetadata(fileId, updates, req.user.id, accountId || req.user.id);
  }

  @Delete(':fileId')
  @ApiOperation({
    summary: 'Delete file (soft delete)',
    description: 'Mark file as deleted (can be restored)'
  })
  @ApiParam({
    name: 'fileId',
    description: 'Unique file identifier',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({ status: 204, description: 'File deleted successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async deleteFile(@Param('fileId') fileId: string, @Req() req: RequestWithUser, @Query('accountId') accountId?: string): Promise<void> {
    await this.fileManagementService.deleteFile(fileId, req.user.id, accountId || req.user.id);
  }

  @Delete(':fileId/permanent')
  @ApiOperation({
    summary: 'Permanently delete file',
    description: 'Permanently delete file from S3 and database (cannot be restored)'
  })
  @ApiParam({
    name: 'fileId',
    description: 'Unique file identifier',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({ status: 204, description: 'File permanently deleted' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async permanentlyDeleteFile(@Param('fileId') fileId: string, @Req() req: RequestWithUser, @Query('accountId') accountId?: string): Promise<void> {
    await this.fileManagementService.permanentlyDeleteFile(fileId, req.user.id, accountId || req.user.id);
  }

  @Get('service/status')
  @ApiOperation({
    summary: 'Get file service status',
    description: 'Check the status and configuration of the file upload service'
  })
  @ApiResponse({
    status: 200,
    description: 'Service status retrieved',
    schema: {
      type: 'object',
      properties: {
        s3Service: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            configuration: { type: 'object' },
            features: { type: 'array', items: { type: 'string' } },
            limitations: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  })
  async getServiceStatus() {
    return {
      s3Service: this.s3Service.getServiceStatus()
    };
  }
}
