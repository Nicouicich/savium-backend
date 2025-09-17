import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { UserProfile, UserProfileSchema } from '../../users/schemas/user-profile.schema';
import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../../files/files.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema }
    ]),
    AiModule,
    FilesModule
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService]
})
export class TelegramModule {}
