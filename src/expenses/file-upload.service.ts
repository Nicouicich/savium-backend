import {Injectable, Logger} from '@nestjs/common';
import {diskStorage} from 'multer';
import {extname} from 'path';
import {v4 as uuidv4} from 'uuid';
import {FileSizeExceededException, InvalidFileTypeException} from '@common/exceptions';

export interface UploadedFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploadedAt: Date;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  getMulterConfig() {
    return {
      storage: diskStorage({
        destination: './uploads/receipts',
        filename: (req: any, file: any, callback: any) => {
          const uniqueSuffix = uuidv4();
          const ext = extname(file.originalname);
          callback(null, `receipt-${uniqueSuffix}${ext}`);
        }
      }),
      fileFilter: (req: any, file: any, callback: any) => {
        if (!this.isValidFileType(file.mimetype)) {
          return callback(new InvalidFileTypeException(this.getAllowedExtensions()), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: this.maxFileSize
      }
    };
  }

  processUploadedFiles(files: Express.Multer.File[]): UploadedFile[] {
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    return files.map(file => this.processUploadedFile(file));
  }

  private processUploadedFile(file: Express.Multer.File): UploadedFile {
    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new FileSizeExceededException(this.maxFileSize, file.size);
    }

    // Validate file type
    if (!this.isValidFileType(file.mimetype)) {
      throw new InvalidFileTypeException(this.getAllowedExtensions());
    }

    return {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      url: `/uploads/receipts/${file.filename}`,
      uploadedAt: new Date()
    };
  }

  private isValidFileType(mimetype: string): boolean {
    return this.allowedTypes.includes(mimetype);
  }

  private getAllowedExtensions(): string[] {
    return this.allowedTypes.map(type => {
      const ext = type.split('/')[1];
      return ext === 'jpeg' ? 'jpg' : ext;
    });
  }

  validateFileUpload(files: Express.Multer.File[]): void {
    if (!files || files.length === 0) {
      throw new Error('At least one file must be provided');
    }

    if (files.length > 5) {
      throw new Error('Maximum 5 files allowed per upload');
    }

    // Validate each file
    files.forEach(file => {
      if (file.size > this.maxFileSize) {
        throw new FileSizeExceededException(this.maxFileSize, file.size);
      }

      if (!this.isValidFileType(file.mimetype)) {
        throw new InvalidFileTypeException(this.getAllowedExtensions());
      }
    });
  }
}
