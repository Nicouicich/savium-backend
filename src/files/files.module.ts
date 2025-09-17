import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { FileMetadata, FileMetadataSchema } from './schemas/file-metadata.schema';
import { FilesController } from './files.controller';
import { FileManagementService } from './services/file-management.service';
import { S3Service } from './services/s3.service';
import { MessagingFileService } from './services/messaging-file.service';
import { awsConfig } from '../config';

@Module({
  imports: [ConfigModule.forFeature(awsConfig), MongooseModule.forFeature([{ name: FileMetadata.name, schema: FileMetadataSchema }])],
  controllers: [FilesController],
  providers: [FileManagementService, S3Service, MessagingFileService],
  exports: [FileManagementService, S3Service, MessagingFileService, MongooseModule]
})
export class FilesModule {}
