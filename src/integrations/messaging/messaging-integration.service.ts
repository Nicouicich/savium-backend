import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { TelegramService } from '../telegram/telegram.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SendMessageRequest, ConnectUserRequest, MessageResult } from './messaging.types';

@Injectable()
export class MessagingIntegrationService {
  private readonly logger = new Logger(MessagingIntegrationService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly telegramService: TelegramService,
    private readonly whatsappService: WhatsappService
  ) {}

  async connectUserToMessaging(request: ConnectUserRequest): Promise<boolean> {
    const { userId, platform, chatId, phoneNumber } = request;

    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const updateData: any = {};

      if (platform === 'telegram' && chatId) {
        updateData.telegramChatId = chatId;
        this.logger.log(`Connected user ${userId} to Telegram chat ${chatId}`);
      }

      if (platform === 'whatsapp' && phoneNumber) {
        updateData.phoneNumber = phoneNumber;
        this.logger.log(`Connected user ${userId} to WhatsApp ${phoneNumber}`);
      }

      await this.userModel.findByIdAndUpdate(userId, updateData, { new: true });
      return true;
    } catch (error) {
      this.logger.error('Error connecting user to messaging platform:', error);
      return false;
    }
  }

  async findUserByChatId(chatId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        telegramChatId: chatId
      })
      .exec();
  }

  async findUserByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    const withPlus = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber;
    const withoutPlus = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;

    return this.userModel
      .findOne({
        $or: [{ phoneNumber: phoneNumber }, { phoneNumber: withPlus }, { phoneNumber: withoutPlus }]
      })
      .exec();
  }

  async sendMessageToUser(request: SendMessageRequest): Promise<{ success: boolean; results: MessageResult[] }> {
    const { userId, message, platform } = request;

    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const results: MessageResult[] = [];

      if (platform === 'telegram' || platform === 'both') {
        const telegramChatId = user.telegramChatId;
        if (telegramChatId) {
          /*  try {
            const success = await this.telegramService.sendMessage(parseInt(telegramChatId), message);
            results.push({
              platform: 'telegram',
              success,
              chatId: telegramChatId
            });
            this.logger.log(`Telegram message sent to user ${userId}: ${success ? 'success' : 'failed'}`);
          } catch (error) {
            results.push({
              platform: 'telegram',
              success: false,
              error: error.message,
              chatId: telegramChatId
            });
          } */
        } else {
          results.push({
            platform: 'telegram',
            success: false,
            error: 'User not connected to Telegram'
          });
        }
      }

      if (platform === 'whatsapp' || platform === 'both') {
        const whatsappPhone = user.phoneNumber;
        if (whatsappPhone) {
          try {
            const success = await this.whatsappService.respondWithCustomMessage(whatsappPhone, message);
            results.push({
              platform: 'whatsapp',
              success,
              phoneNumber: whatsappPhone
            });
            this.logger.log(`WhatsApp message sent to user ${userId}: ${success ? 'success' : 'failed'}`);
          } catch (error) {
            results.push({
              platform: 'whatsapp',
              success: false,
              error: error.message,
              phoneNumber: whatsappPhone
            });
          }
        } else {
          results.push({
            platform: 'whatsapp',
            success: false,
            error: 'User not connected to WhatsApp'
          });
        }
      }

      const overallSuccess = results.some(r => r.success);
      return { success: overallSuccess, results };
    } catch (error) {
      this.logger.error('Error sending message to user:', error);
      return {
        success: false,
        results: [
          {
            platform: platform,
            success: false,
            error: error.message
          }
        ]
      };
    }
  }

  async getUserMessagingStatus(userId: string): Promise<{
    userId: string;
    telegram: { connected: boolean; chatId?: string };
    whatsapp: { connected: boolean; phoneNumber?: string };
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return {
      userId,
      telegram: {
        connected: !!user.telegramChatId,
        chatId: user.telegramChatId
      },
      whatsapp: {
        connected: !!user.phoneNumber,
        phoneNumber: user.phoneNumber
      }
    };
  }

  async autoConnectFromIncomingMessage(
    platform: 'telegram' | 'whatsapp',
    identifier: string,
    additionalData?: {
      username?: string;
      firstName?: string;
      lastName?: string;
      name?: string;
    }
  ): Promise<UserDocument | null> {
    let user: UserDocument | null = null;

    if (platform === 'telegram') {
      user = await this.findUserByChatId(identifier);
      if (!user) {
        this.logger.log(`No user found for Telegram chat ${identifier}, creating temporary association`);
        // You might want to create a temporary user or handle this differently
        return null;
      }
    }

    if (platform === 'whatsapp') {
      user = await this.findUserByPhoneNumber(identifier);
      if (!user) {
        this.logger.log(`No user found for WhatsApp ${identifier}, creating temporary association`);
        return null;
      }
    }

    return user;
  }
}
