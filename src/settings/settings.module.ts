import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { Tag, TagSchema } from './schemas/tag.schema';

@Module({
  imports: [UsersModule, MongooseModule.forFeature([{ name: Tag.name, schema: TagSchema }])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService]
})
export class SettingsModule {}
