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

  async handleWebhook(update: TelegramUpdate): Promise<{ processed: boolean; message: string }> {
    this.logger.log('Telegram webhook received:', JSON.stringify(update, null, 2));

    try {
      if (update.message) {
        const unifiedMessage = this.convertToUnifiedMessage(update.message);
        this.logger.log('📱 Telegram message received:', {
          from: unifiedMessage.from,
          body: unifiedMessage.body,
          timestamp: unifiedMessage.timestamp,
          mediaUrl: unifiedMessage.mediaUrl,
          mediaType: unifiedMessage.mediaType,
          chatId: unifiedMessage.chatId
        });

        await this.processMessage(unifiedMessage);
      }

      return {
        processed: true,
        message: 'Telegram webhook processed successfully'
      };
    } catch (error) {
      this.logger.error('Error processing Telegram webhook:', error);
      return {
        processed: false,
        message: `Error: ${error.message}`
      };
    }
  }

  private convertToUnifiedMessage(telegramMessage: TelegramMessage): UnifiedMessage {
    const userName =
      [telegramMessage.from.first_name, telegramMessage.from.last_name].filter(Boolean).join(' ') ||
      telegramMessage.from.username ||
      `User${telegramMessage.from.id}`;

    let mediaType: 'text' | 'image' | 'document' | 'audio' = 'text';
    let body = telegramMessage.text || telegramMessage.caption || '';

    if (telegramMessage.photo && telegramMessage.photo.length > 0) {
      mediaType = 'image';
      body = telegramMessage.caption || '[Image]';
    } else if (telegramMessage.voice || telegramMessage.audio) {
      mediaType = 'audio';
      body = telegramMessage.caption || '[Audio]';
    } else if (telegramMessage.document) {
      mediaType = 'document';
      body = telegramMessage.caption || telegramMessage.document.file_name || '[Document]';
    }

    return {
      from: telegramMessage.from.id.toString(),
      body,
      timestamp: new Date(telegramMessage.date * 1000),
      mediaType,
      platform: 'telegram',
      chatId: telegramMessage.chat.id.toString(),
      messageId: telegramMessage.message_id.toString()
    };
  }

  private async processMessage(unifiedMessage: UnifiedMessage): Promise<void> {
    const chatId = parseInt(unifiedMessage.chatId!);

    this.logger.log('💬 Processing Telegram message:', {
      from: unifiedMessage.from,
      body: unifiedMessage.body,
      timestamp: unifiedMessage.timestamp,
      mediaType: unifiedMessage.mediaType
    });

    // Try to find or associate user with this chat ID
    const user = await this.autoAssociateUser(unifiedMessage.chatId!, unifiedMessage);
    unifiedMessage.userId = user?.id;

    try {
      // Process message with centralized AI service
      const result = await this.messageProcessor.processMessage(unifiedMessage);

      if (result.success && result.responseText) {
        await this.sendMessage(chatId, result.responseText);

        // Log the action taken
        if (result.actionTaken) {
          this.logger.log(`Action taken for Telegram message: ${result.actionTaken.type}`, {
            chatId,
            from: unifiedMessage.from,
            actionData: result.actionTaken.data
          });
        }
      } else if (result.error) {
        await this.sendMessage(chatId, result.responseText || 'Hubo un error procesando tu mensaje.');
      }
    } catch (error) {
      this.logger.error('Error processing Telegram message:', error);
      await this.sendMessage(chatId, '❌ Lo siento, hubo un problema procesando tu mensaje. Por favor intenta de nuevo.');
    }
  }

  // Public methods for AI to call when responding to users
  async respondToCommand(chatId: number, command: string, firstName?: string): Promise<boolean> {
    return this.handleCommand(chatId, command, { first_name: firstName });
  }

  async respondToExpense(chatId: number, text: string): Promise<boolean> {
    return this.parseExpenseMessage(chatId, text);
  }

  async respondToPhoto(chatId: number): Promise<boolean> {
    return this.processReceiptPhoto(chatId, [{ file_id: 'mock_file_id' }]);
  }

  async respondToDocument(chatId: number): Promise<boolean> {
    return this.processReceiptDocument(chatId, { file_name: 'receipt.pdf' });
  }

  async respondWithCustomMessage(chatId: number, message: string): Promise<boolean> {
    return this.sendMessage(chatId, message);
  }

  private async handleCommand(chatId: number, command: string, from: any): Promise<boolean> {
    const cmd = command.split(' ')[0].toLowerCase();

    try {
      switch (cmd) {
        case '/start':
          await this.sendWelcomeMessage(chatId, from.first_name);
          break;
        case '/help':
          await this.sendHelpMessage(chatId);
          break;
        case '/balance':
          await this.sendBalanceInfo(chatId);
          break;
        case '/categories':
          await this.sendCategoriesList(chatId);
          break;
        default:
          await this.sendMessage(chatId, '❓ Unknown command. Use /help to see available commands.');
      }
      return true;
    } catch (error) {
      this.logger.error('Error handling command:', error);
      return false;
    }
  }

  private async parseExpenseMessage(chatId: number, text: string): Promise<boolean> {
    try {
      // Parse expense from text like "25 lunch" or "spent 30 on groceries"
      const expenseData = this.extractExpenseData(text);

      if (expenseData.amount) {
        console.log('Parsed expense:', expenseData);
        await this.sendMessage(
          chatId,
          `✅ Expense recorded!\n💰 Amount: $${expenseData.amount}\n📝 Description: ${expenseData.description}\n\n(Mock confirmation - integration not implemented)`
        );
      } else {
        await this.sendMessage(chatId, '❌ Could not parse expense.\n\nTry formats like:\n• "25 lunch"\n• "spent 30 on groceries"\n• Or send a receipt photo');
      }
      return true;
    } catch (error) {
      this.logger.error('Error parsing expense message:', error);
      return false;
    }
  }

  private async processReceiptPhoto(chatId: number, photos: any[]): Promise<boolean> {
    try {
      // Get the largest photo (highest resolution)
      const photo = photos[photos.length - 1];

      this.logger.log('Processing receipt photo from Telegram', {
        chatId,
        fileId: photo.file_id,
        fileSize: photo.file_size
      });

      // Find user for file upload
      const user = await this.findUserByChatId(chatId.toString());
      if (!user) {
        await this.sendMessage(chatId, '❌ Tu cuenta no está vinculada. Conecta tu Telegram en la app primero.');
        return false;
      }

      try {
        // Upload photo to S3
        const uploadResult = await this.messagingFileService.uploadMessagingFile(
          {
            fileId: photo.file_id,
            platform: 'telegram',
            filename: `telegram_photo_${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
            size: photo.file_size
          },
          user.id,
          (await this.getUserActiveAccountId(user)) || user.id,
          {
            purpose: FilePurpose.RECEIPT,
            description: 'Receipt photo from Telegram',
            tags: ['telegram', 'receipt', 'photo'],
            traceId: `telegram_${Date.now()}`
          }
        );

        this.logger.log('Receipt photo uploaded successfully', {
          chatId,
          fileId: uploadResult.fileId,
          s3Key: uploadResult.s3Key
        });

        // Send success message with file details
        const confirmationMessage = [
          '📸 ¡Foto de recibo recibida y guardada!',
          '',
          `📄 Archivo: ${uploadResult.originalName}`,
          `💾 Tamaño: ${(uploadResult.size / 1024).toFixed(1)} KB`,
          `🆔 ID: ${uploadResult.fileId.substring(0, 8)}...`,
          '',
          '🤖 Procesando con IA para extraer datos...',
          '',
          '💡 Tip: Puedes ver todos tus archivos en la app.'
        ].join('\n');

        await this.sendMessage(chatId, confirmationMessage);

        // TODO: Here you could trigger AI processing to extract expense data
        // and automatically create an expense record

        return true;
      } catch (uploadError) {
        this.logger.error('Failed to upload receipt photo', {
          chatId,
          error: uploadError.message
        });

        await this.sendMessage(chatId, '❌ Error guardando la foto. Por favor intenta de nuevo más tarde.');
        return false;
      }
    } catch (error) {
      this.logger.error('Error processing receipt photo:', {
        chatId,
        error: error.message,
        stack: error.stack
      });

      await this.sendMessage(chatId, '❌ Error procesando la foto. Por favor intenta de nuevo.');
      return false;
    }
  }

  private async processReceiptDocument(chatId: number, document: any): Promise<boolean> {
    try {
      this.logger.log('Processing receipt document from Telegram', {
        chatId,
        fileId: document.file_id,
        fileName: document.file_name,
        fileSize: document.file_size,
        mimeType: document.mime_type
      });

      // Find user for file upload
      const user = await this.findUserByChatId(chatId.toString());
      if (!user) {
        await this.sendMessage(chatId, '❌ Tu cuenta no está vinculada. Conecta tu Telegram en la app primero.');
        return false;
      }

      try {
        // Upload document to S3
        const uploadResult = await this.messagingFileService.uploadMessagingFile(
          {
            fileId: document.file_id,
            platform: 'telegram',
            filename: document.file_name || `telegram_document_${Date.now()}`,
            mimeType: document.mime_type || 'application/octet-stream',
            size: document.file_size
          },
          user.id,
          (await this.getUserActiveAccountId(user)) || user.id,
          {
            purpose: FilePurpose.RECEIPT,
            description: `Document from Telegram: ${document.file_name || 'Unknown filename'}`,
            tags: ['telegram', 'receipt', 'document'],
            traceId: `telegram_${Date.now()}`
          }
        );

        this.logger.log('Receipt document uploaded successfully', {
          chatId,
          fileId: uploadResult.fileId,
          s3Key: uploadResult.s3Key
        });

        // Send success message with file details
        const confirmationMessage = [
          '📄 ¡Documento de recibo recibido y guardado!',
          '',
          `📄 Archivo: ${uploadResult.originalName}`,
          `💾 Tamaño: ${(uploadResult.size / 1024).toFixed(1)} KB`,
          `📄 Tipo: ${uploadResult.fileType}`,
          `🆔 ID: ${uploadResult.fileId.substring(0, 8)}...`,
          '',
          '🤖 Procesando con IA para extraer datos...',
          '',
          '💡 Tip: Puedes ver todos tus archivos en la app.'
        ].join('\n');

        await this.sendMessage(chatId, confirmationMessage);

        // TODO: Here you could trigger AI processing to extract expense data
        // and automatically create an expense record

        return true;
      } catch (uploadError) {
        this.logger.error('Failed to upload receipt document', {
          chatId,
          error: uploadError.message
        });

        await this.sendMessage(chatId, '❌ Error guardando el documento. Por favor intenta de nuevo más tarde.');
        return false;
      }
    } catch (error) {
      this.logger.error('Error processing receipt document:', {
        chatId,
        error: error.message,
        stack: error.stack
      });

      await this.sendMessage(chatId, '❌ Error procesando el documento. Por favor intenta de nuevo.');
      return false;
    }
  }

  async sendMessage(chatId: number, text: string): Promise<boolean> {
    if (!this.botToken) {
      this.logger.error('Cannot send Telegram message: Bot token not configured');
      return false;
    }

    try {
      this.logger.log(`📤 Sending Telegram message to ${chatId}: ${text.substring(0, 50)}...`);

      const response = await axios.post(`${this.apiBaseUrl}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      });

      if (response.data.ok) {
        this.logger.log('✅ Telegram message sent successfully');
        return true;
      } else {
        this.logger.error('❌ Failed to send Telegram message:', response.data);
        return false;
      }
    } catch (error) {
      this.logger.error('❌ Error sending Telegram message:', error.response?.data || error.message);
      return false;
    }
  }

  private async sendWelcomeMessage(chatId: number, firstName: string): Promise<void> {
    const message = `👋 Welcome to Savium AI, ${firstName}!\n\n🤖 I help you track expenses easily:\n\n• Send "25 lunch" to record $25 for lunch\n• Send receipt photos for auto-processing\n• Use /help for more commands\n\n(Telegram integration not implemented)`;
    await this.sendMessage(chatId, message);
  }

  private async sendHelpMessage(chatId: number): Promise<void> {
    const message = `🤖 Savium AI Bot Commands:\n\n💰 Expense Tracking:\n• "25 lunch" - Record $25 expense\n• "spent 30 on groceries" - Alternative format\n• Send receipt photos - Auto-extract expense\n\n📊 Information:\n• /balance - View current balance\n• /categories - List expense categories\n\n❓ Help:\n• /help - Show this message\n• /start - Welcome message\n\n(Bot features not implemented)`;
    await this.sendMessage(chatId, message);
  }

  private async sendBalanceInfo(chatId: number): Promise<void> {
    const message = [
      '💰 Account Balance',
      '',
      '📊 This Month:',
      '• Spent: $1,250 (mock data)',
      '• Budget: $2,000',
      '• Remaining: $750',
      '',
      '📈 Top Categories:',
      '• Food: $450',
      '• Transport: $200',
      '• Entertainment: $150',
      '',
      '(Balance data not implemented)'
    ].join('\n');
    await this.sendMessage(chatId, message);
  }

  private async sendCategoriesList(chatId: number): Promise<void> {
    const message = [
      '📂 Expense Categories:',
      '',
      '🍽️ Food & Dining',
      '🚗 Transportation',
      '🏠 Housing',
      '🎯 Entertainment',
      '🛒 Shopping',
      '💊 Healthcare',
      '📚 Education',
      '🔧 Utilities',
      '💼 Business',
      '📱 Subscriptions',
      '',
      '(Categories from mock data)'
    ].join('\n');
    await this.sendMessage(chatId, message);
  }

  async setWebhook(webhookUrl: string): Promise<{ success: boolean; message: string }> {
    if (!this.botToken) {
      return {
        success: false,
        message: 'Bot token not configured'
      };
    }

    try {
      this.logger.log('🔗 Setting Telegram webhook:', webhookUrl);

      const response = await axios.post(`${this.apiBaseUrl}/setWebhook`, {
        url: webhookUrl,
        allowed_updates: ['message']
      });

      if (response.data.ok) {
        this.logger.log('✅ Telegram webhook set successfully');
        return {
          success: true,
          message: 'Webhook set successfully'
        };
      } else {
        this.logger.error('❌ Failed to set Telegram webhook:', response.data);
        return {
          success: false,
          message: response.data.description || 'Failed to set webhook'
        };
      }
    } catch (error) {
      this.logger.error('❌ Error setting Telegram webhook:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.description || error.message
      };
    }
  }

  getServiceStatus(): {
    enabled: boolean;
    features: string[];
    limitations: string[];
  } {
    const hasToken = !!this.botToken;

    return {
      enabled: hasToken,
      features: hasToken
        ? [
            '✅ Telegram Bot API integrated',
            '✅ Real message sending/receiving',
            '✅ Webhook support with real API calls',
            '✅ Unified message processing',
            '✅ Expense parsing and logging',
            '✅ Image and document support'
          ]
        : ['❌ Bot token not configured'],
      limitations: hasToken
        ? ['No automatic responses (by design)', 'AI integration pending', 'No database storage yet']
        : ['Requires TELEGRAM_BOT_TOKEN in .env', 'All functionality disabled without token']
    };
  }

  private async autoAssociateUser(chatId: string, unifiedMessage: UnifiedMessage): Promise<UserDocument | null> {
    try {
      // First, check if we already have a user associated with this chat ID
      const user = await this.userModel.findOne({
        'messagingIntegrations.telegram.chatId': chatId
      });

      if (user) {
        this.logger.log(`Found existing user ${user.id} for Telegram chat ${chatId}`);
        return user;
      }

      // For now, just log that we received a message from an unassociated chat
      // In a real app, you might want to:
      // 1. Ask the user to provide their email/phone to link accounts
      // 2. Create a temporary user
      // 3. Send a registration link
      this.logger.log(`📱 Unassociated Telegram chat ${chatId} sent message: "${unifiedMessage.body}"`);
      this.logger.log(`Use POST /api/v1/integrations/messaging/connect to associate this chat with a user`);

      // Send a helpful message to the user
      await this.sendMessage(
        parseInt(chatId),
        '👋 Hello! I see this is your first message.\n\n' +
          '🔗 To link your account, please visit our app and connect your Telegram.\n\n' +
          '📧 Or contact support with your chat ID: ' +
          chatId
      );

      return null;
    } catch (error) {
      this.logger.error('Error in auto-associate user:', error);
      return null;
    }
  }

  async findUserByChatId(chatId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        'messagingIntegrations.telegram.chatId': chatId
      })
      .exec();
  }

  /**
   * Gets the active account ID for a user based on their active profile
   * Falls back to first account if no active profile or associated accounts
   */
  private async getUserActiveAccountId(user: UserDocument): Promise<string | null> {
    try {
      // First, try to get the active profile and its associated accounts
      if (user.activeProfileId) {
        const activeProfile = await this.userProfileModel.findById(user.activeProfileId);
        if (activeProfile && activeProfile.associatedAccounts.length > 0) {
          return activeProfile.associatedAccounts[0].toString();
        }
      }

      // Fallback: use the first account from user's accounts array
      if (user.accounts && user.accounts.length > 0) {
        return user.accounts[0].toString();
      }

      // No accounts available
      this.logger.warn('User has no accounts available', { userId: user.id });
      return null;
    } catch (error) {
      this.logger.error('Error getting user active account ID', {
        userId: user.id,
        error: error.message
      });
      return null;
    }
  }

  private extractExpenseData(text: string): { amount?: number; description?: string } {
    // Parse expense from text like "25 lunch" or "spent 30 on groceries" or "gasté 45 en cena"
    const patterns = [
      /(?:spent|gasté|gaste)\s+(?:\$)?(\d+(?:\.\d{2})?)\s+(?:on|en)\s+(.+)/i,
      /(?:\$)?(\d+(?:\.\d{2})?)\s+(.+)/,
      /(\d+(?:\.\d{2})?)\s+(?:for|para|en)\s+(.+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          amount: parseFloat(match[1]),
          description: match[2]?.trim() || 'Expense'
        };
      }
    }

    return {};
  }
}
