import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilesModule } from '../../files/files.module';
import { UserProfile, UserProfileSchema } from '../../users/schemas/user-profile.schema';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { AiModule } from '../ai/ai.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

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
