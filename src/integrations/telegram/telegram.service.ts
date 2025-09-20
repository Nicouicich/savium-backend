import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { UserProfile, UserProfileDocument } from '../../users/schemas/user-profile.schema';
import { MessageProcessorService, UnifiedMessage } from '../ai/message-processor.service';
import { MessagingFileService } from '../../files/services/messaging-file.service';
import { FilePurpose } from '../../files/schemas/file-metadata.schema';

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
  };
  date: number;
  text?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    width: number;
    height: number;
  }>;
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  voice?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
  audio?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    performer?: string;
    title?: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  caption?: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string | undefined;
  private readonly apiBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
    private readonly messageProcessor: MessageProcessorService,
    private readonly messagingFileService: MessagingFileService
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.apiBaseUrl = `https://api.telegram.org/bot${this.botToken}`;

    this.logger.debug('Telegram service initialized', {
      hasBotToken: !!this.botToken,
      apiUrl: this.botToken ? `https://api.telegram.org/bot${this.botToken.substring(0, 10)}...` : 'No token'
    });
  }
}
