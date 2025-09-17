import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagingIntegrationService } from './messaging-integration.service';
import { MessagingIntegrationController } from './messaging-integration.controller';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { TelegramModule } from '../telegram/telegram.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), TelegramModule, WhatsappModule],
  controllers: [MessagingIntegrationController],
  providers: [MessagingIntegrationService],
  exports: [MessagingIntegrationService]
})
export class MessagingIntegrationModule {}
