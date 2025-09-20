import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Readable } from 'stream';

import { FileUploadResponseDto } from '../dto/upload-file.dto';
import { FilePurpose } from '../schemas/file-metadata.schema';
import { FileManagementService, UploadFileRequest } from './file-management.service';

export interface MessagingFileDownload {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export interface MessagingFileInfo {
  fileId: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  caption?: string;
  platform: 'whatsapp' | 'telegram';
}

@Injectable()
export class MessagingFileService {
  private readonly logger = new Logger(MessagingFileService.name);

  constructor(
    private readonly fileManagementService: FileManagementService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Download file from WhatsApp Business API
   */
  async downloadWhatsAppFile(fileId: string): Promise<MessagingFileDownload> {
    const accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN');

    if (!accessToken) {
      throw new Error('WhatsApp access token not configured');
    }

    try {
      // Step 1: Get file URL from WhatsApp API
      const fileInfoUrl = `https://graph.facebook.com/v17.0/${fileId}`;
      const fileInfoResponse = await axios.get(fileInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const { url, mime_type, sha256, file_size } = fileInfoResponse.data;

      this.logger.debug('WhatsApp file info retrieved', {
        fileId,
        mimeType: mime_type,
        size: file_size,
        hasUrl: !!url
      });

      // Step 2: Download file content
      const fileResponse = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        responseType: 'arraybuffer',
        timeout: 30000 // 30 seconds timeout
      });

      const buffer = Buffer.from(fileResponse.data);

      // Generate filename based on file type and timestamp
      const extension = this.getExtensionFromMimeType(mime_type);
      const filename = `whatsapp_${Date.now()}${extension}`;

      this.logger.log('WhatsApp file downloaded successfully', {
        fileId,
        filename,
        downloadedSize: buffer.length,
        expectedSize: file_size
      });

      return {
        buffer,
        filename,
        mimeType: mime_type,
        size: buffer.length
      };
    } catch (error) {
      this.logger.error('Failed to download WhatsApp file', {
        fileId,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Failed to download WhatsApp file: ${error.message}`);
    }
  }

  /**
   * Download file from Telegram Bot API
   */
  async downloadTelegramFile(fileId: string): Promise<MessagingFileDownload> {
    const botToken = this.configService.get('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      throw new Error('Telegram bot token not configured');
    }

    try {
      // Step 1: Get file path from Telegram API
      const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
      const fileInfoResponse = await axios.get(fileInfoUrl);

      if (!fileInfoResponse.data.ok) {
        throw new Error(fileInfoResponse.data.description || 'Failed to get file info');
      }

      const { file_path, file_size } = fileInfoResponse.data.result;

      this.logger.debug('Telegram file info retrieved', {
        fileId,
        filePath: file_path,
        size: file_size
      });

      // Step 2: Download file content
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file_path}`;
      const fileResponse = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 seconds timeout
      });

      const buffer = Buffer.from(fileResponse.data);

      // Extract filename from path or generate one
      const pathParts = file_path.split('/');
      const originalName = pathParts[pathParts.length - 1];
      const filename = originalName || `telegram_${Date.now()}`;

      // Detect MIME type from content or filename
      const mimeType = this.detectMimeType(buffer, filename);

      this.logger.log('Telegram file downloaded successfully', {
        fileId,
        filename,
        downloadedSize: buffer.length,
        expectedSize: file_size,
        mimeType
      });

      return {
        buffer,
        filename,
        mimeType,
        size: buffer.length
      };
    } catch (error) {
      this.logger.error('Failed to download Telegram file', {
        fileId,
        error: error.message,
        status: error.response?.status
      });
      throw new Error(`Failed to download Telegram file: ${error.message}`);
    }
  }

  /**
   * Upload messaging file to S3 with proper context
   */
  async uploadMessagingFile(
    fileInfo: MessagingFileInfo,
    userId: string,
    accountId: string,
    options: {
      purpose?: FilePurpose;
      description?: string;
      tags?: string[];
      traceId?: string;
    } = {}
  ): Promise<FileUploadResponseDto> {
    const { platform, caption } = fileInfo;
    const { purpose = FilePurpose.RECEIPT, description, tags = [], traceId } = options;

    this.logger.log('Starting messaging file upload', {
      traceId,
      platform,
      fileId: fileInfo.fileId,
      userId,
      accountId,
      purpose
    });

    try {
      // Download file from messaging platform
      let download: MessagingFileDownload;

      if (platform === 'whatsapp') {
        download = await this.downloadWhatsAppFile(fileInfo.fileId);
      } else if (platform === 'telegram') {
        download = await this.downloadTelegramFile(fileInfo.fileId);
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Prepare upload request
      const uploadRequest: UploadFileRequest = {
        buffer: download.buffer,
        originalName: download.filename,
        mimeType: download.mimeType,
        size: download.size,
        uploadDto: {
          purpose,
          description: description || caption || `File from ${platform}`,
          tags: [...tags, platform, purpose, 'messaging_platform'],
          uploadSource: platform,
          metadata: {
            originalFileId: fileInfo.fileId,
            platform,
            caption: caption || '',
            downloadedAt: new Date().toISOString()
          }
        },
        userId,
        accountId,
        traceId
      };

      // Upload to S3
      const result = await this.fileManagementService.uploadFile(uploadRequest);

      this.logger.log('Messaging file uploaded successfully', {
        traceId,
        platform,
        originalFileId: fileInfo.fileId,
        newFileId: result.fileId,
        s3Key: result.s3Key
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to upload messaging file', {
        traceId,
        platform,
        fileId: fileInfo.fileId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
    };

    return mimeToExt[mimeType.toLowerCase()] || '';
  }

  /**
   * Detect MIME type from buffer content or filename
   */
  private detectMimeType(buffer: Buffer, filename: string): string {
    // Check magic bytes for common file types
    const magicBytes = buffer.slice(0, 12);

    // JPEG
    if (magicBytes[0] === 0xff && magicBytes[1] === 0xd8) {
      return 'image/jpeg';
    }

    // PNG
    if (magicBytes.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return 'image/png';
    }

    // GIF
    if (magicBytes.slice(0, 6).equals(Buffer.from('GIF87a')) || magicBytes.slice(0, 6).equals(Buffer.from('GIF89a'))) {
      return 'image/gif';
    }

    // PDF
    if (magicBytes.slice(0, 4).equals(Buffer.from('%PDF'))) {
      return 'application/pdf';
    }

    // MP3
    if ((magicBytes[0] === 0xff && (magicBytes[1] & 0xe0) === 0xe0) || magicBytes.slice(0, 3).equals(Buffer.from('ID3'))) {
      return 'audio/mpeg';
    }

    // Fall back to filename extension
    const ext = filename.toLowerCase().split('.').pop();
    const extToMime: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      pdf: 'application/pdf',
      txt: 'text/plain',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    return extToMime[ext || ''] || 'application/octet-stream';
  }

  /**
   * Get service status
   */
  getServiceStatus(): {
    enabled: boolean;
    configuration: Record<string, any>;
    features: string[];
    limitations: string[];
  } {
    const hasWhatsAppToken = !!this.configService.get('WHATSAPP_ACCESS_TOKEN');
    const hasTelegramToken = !!this.configService.get('TELEGRAM_BOT_TOKEN');

    return {
      enabled: hasWhatsAppToken || hasTelegramToken,
      configuration: {
        whatsappEnabled: hasWhatsAppToken,
        telegramEnabled: hasTelegramToken
      },
      features: [
        ...(hasWhatsAppToken ? ['WhatsApp file download and upload'] : []),
        ...(hasTelegramToken ? ['Telegram file download and upload'] : []),
        'Automatic MIME type detection',
        'File metadata extraction',
        'S3 upload integration',
        'Platform-specific tagging'
      ],
      limitations: [
        'File download timeout: 30 seconds',
        'Supported platforms: WhatsApp, Telegram',
        ...(!hasWhatsAppToken ? ['WhatsApp integration disabled (no access token)'] : []),
        ...(!hasTelegramToken ? ['Telegram integration disabled (no bot token)'] : [])
      ]
    };
  }
}
