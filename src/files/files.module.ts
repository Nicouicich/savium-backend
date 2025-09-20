import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { awsConfig } from '../config';
import { FilesController } from './files.controller';
import { FileMetadata, FileMetadataSchema } from './schemas/file-metadata.schema';
import { FileManagementService } from './services/file-management.service';
import { MessagingFileService } from './services/messaging-file.service';
import { S3Service } from './services/s3.service';

@Module({
  imports: [ConfigModule.forFeature(awsConfig), MongooseModule.forFeature([{ name: FileMetadata.name, schema: FileMetadataSchema }])],
  controllers: [FilesController],
  providers: [FileManagementService, S3Service, MessagingFileService],
  exports: [FileManagementService, S3Service, MessagingFileService, MongooseModule]
})
export class FilesModule {}
