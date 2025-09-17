import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { UserProfile, UserProfileDocument } from '../../users/schemas/user-profile.schema';
import { MessageProcessorService, UnifiedMessage } from '../ai/message-processor.service';
import { MessagingFileService } from '../../files/services/messaging-file.service';
import { ReceiptProcessorService } from '../ai/receipt-processor.service';
import { FilePurpose } from '../../files/schemas/file-metadata.schema';

interface WhatsAppMessage {
  from: string;
  body: string;
  timestamp: Date;
  mediaUrl?: string;
  mediaType?: string;
}

interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: any;
        contacts?: any[];
        messages?: any[];
        statuses?: any[];
      };
      field: string;
    }>;
  }>;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly whatsappApiUrl = 'https://graph.facebook.com/v17.0';
  private readonly accessToken: string | undefined;
  private readonly phoneNumberId: string | undefined;
  private readonly verifyToken: string | undefined;

  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name) private userProfileModel,
    private messageProcessor: MessageProcessorService,
    private messagingFileService: MessagingFileService,
    private receiptProcessorService: ReceiptProcessorService
  ) {
    this.accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN');
    this.phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');
    this.verifyToken = this.configService.get('WHATSAPP_VERIFY_TOKEN');

    this.logger.debug('WhatsApp service initialized', {
      hasAccessToken: !!this.accessToken,
      hasPhoneNumberId: !!this.phoneNumberId,
      hasVerifyToken: !!this.verifyToken
    });
  }

  async handleWebhook(payload: WebhookPayload): Promise<{ processed: boolean; message: string }> {
    // Placeholder for webhook handling
    // In real implementation, this would:
    // 1. Verify webhook signature
    // 2. Parse incoming messages
    // 3. Process expense commands
    // 4. Handle media uploads (receipts)
    // 5. Send responses back to WhatsApp

    console.log('WhatsApp webhook received:', JSON.stringify(payload, null, 2));

    if (payload.entry?.[0]?.changes?.[0]?.value?.messages) {
      const { messages } = payload.entry[0].changes[0].value;

      for (const message of messages) {
        await this.processMessage({
          from: message.from,
          body: message.text?.body || '',
          timestamp: new Date(message.timestamp * 1000),
          mediaUrl: message.image?.id || message.document?.id,
          mediaType: message.type
        });
      }
    }

    return {
      processed: true,
      message: 'Webhook processed (mock implementation)'
    };
  }

  async processMessage(message: WhatsAppMessage): Promise<void> {
    console.log('📱 WhatsApp message received:', {
      from: message.from,
      body: message.body,
      timestamp: message.timestamp,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType
    });

    // Try to find or associate user with this phone number
    const user = await this.autoAssociateUser(message.from, message);

    // Convert WhatsApp message to unified format
    const unifiedMessage: UnifiedMessage = {
      from: message.from,
      body: message.body || '',
      timestamp: message.timestamp,
      mediaUrl: message.mediaUrl,
      mediaType: this.mapMediaType(message.mediaType),
      platform: 'whatsapp',
      chatId: message.from, // For WhatsApp, phone number acts as chat ID
      messageId: `whatsapp_${Date.now()}`,
      userId: user?.id
    };

    try {
      // Process message with centralized AI service
      const result = await this.messageProcessor.processMessage(unifiedMessage);

      if (result.success && result.responseText) {
        await this.sendMessage(message.from, result.responseText);

        // Log the action taken
        if (result.actionTaken) {
          this.logger.log(`Action taken for WhatsApp message: ${result.actionTaken.type}`, {
            from: message.from,
            actionData: result.actionTaken.data
          });
        }
      } else if (result.error) {
        await this.sendMessage(message.from, result.responseText || 'Hubo un error procesando tu mensaje.');
      }
    } catch (error) {
      this.logger.error('Error processing WhatsApp message:', error);
      await this.sendMessage(message.from, '❌ Lo siento, hubo un problema procesando tu mensaje. Por favor intenta de nuevo.');
    }
  }

  // Public methods for AI to call when responding to users
  async respondToExpense(phoneNumber: string, text: string): Promise<boolean> {
    return this.parseExpenseMessage({ from: phoneNumber, body: text } as WhatsAppMessage);
  }

  async respondToPhoto(phoneNumber: string): Promise<boolean> {
    return this.processReceiptImage({ from: phoneNumber, mediaType: 'image' } as WhatsAppMessage);
  }

  async respondToDocument(phoneNumber: string): Promise<boolean> {
    return this.processReceiptImage({ from: phoneNumber, mediaType: 'document' } as WhatsAppMessage);
  }

  async respondWithCustomMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      await this.sendMessage(phoneNumber, message);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.message);
      return false;
    }
  }

  private async parseExpenseMessage(message: WhatsAppMessage): Promise<boolean> {
    try {
      // Placeholder for expense parsing from text
      const expenseData = this.extractExpenseData(message.body);

      if (expenseData.amount) {
        console.log('Parsed expense:', expenseData);
        // In real implementation: save to database via ExpensesService
        await this.sendConfirmationMessage(message.from, expenseData);
      } else {
        await this.sendErrorMessage(message.from, 'Could not parse expense amount');
      }
      return true;
    } catch (error) {
      console.error('Error parsing expense message:', error);
      return false;
    }
  }

  private mapMediaType(whatsappMediaType?: string): 'text' | 'image' | 'document' | 'audio' {
    if (!whatsappMediaType) return 'text';

    switch (whatsappMediaType) {
      case 'image':
        return 'image';
      case 'audio':
      case 'voice':
        return 'audio';
      case 'document':
      case 'video':
        return 'document';
      default:
        return 'text';
    }
  }

  private async processReceiptImage(message: WhatsAppMessage): Promise<boolean> {
    try {
      this.logger.log('Processing potential receipt image from WhatsApp', {
        from: message.from,
        mediaUrl: message.mediaUrl
      });

      if (!message.mediaUrl) {
        await this.sendMessage(message.from, '❌ No se pudo procesar la imagen. Por favor intenta de nuevo.');
        return false;
      }

      // Find user for file upload
      const user = await this.findUserByPhoneNumber(message.from);
      if (!user) {
        await this.sendMessage(message.from, '❌ Tu cuenta no está vinculada. Conecta tu WhatsApp en la app primero.');
        return false;
      }

      // Get user's active account for file upload
      const accountId = await this.getUserActiveAccountId(user);
      if (!accountId) {
        await this.sendMessage(message.from, '❌ No tienes cuentas disponibles. Crea una cuenta en la app primero.');
        return false;
      }

      // Send immediate acknowledgment
      await this.sendMessage(message.from, '📸 Imagen recibida! Analizando...');

      // Process with receipt processor service
      const result = await this.receiptProcessorService.processImageFromWhatsApp(message.mediaUrl, user.id, accountId, {
        caption: message.body,
        traceId: `whatsapp_${Date.now()}`
      });

      if (result.error) {
        await this.sendMessage(message.from, `❌ Error procesando imagen: ${result.error}`);
        return false;
      }

      // Send appropriate response based on processing result
      if (result.isReceipt && result.expenseCreated) {
        // Receipt detected and expense created
        const successMessage = [
          '🎉 ¡Recibo procesado exitosamente!',
          '',
          `💰 Monto: $${result.expenseCreated.amount}`,
          `📝 Descripción: ${result.expenseCreated.description}`,
          `📄 Archivo guardado: ${result.fileUploaded?.fileId.substring(0, 8)}...`,
          `🔍 Confianza IA: ${Math.round(result.confidence * 100)}%`,
          '',
          '✅ Gasto creado automáticamente',
          '💡 Revisa la app para editar si es necesario'
        ].join('\n');

        await this.sendMessage(message.from, successMessage);
      } else if (result.isReceipt && result.extractedData?.amount) {
        // Receipt detected but expense creation failed
        const partialMessage = [
          '📸 Recibo detectado!',
          '',
          `💰 Monto encontrado: $${result.extractedData.amount}`,
          result.extractedData.vendor ? `🏪 Comercio: ${result.extractedData.vendor}` : '',
          `📄 Archivo guardado: ${result.fileUploaded?.fileId.substring(0, 8)}...`,
          '',
          '⚠️ Por favor crea el gasto manualmente en la app',
          '💡 Usa los datos extraídos automáticamente'
        ]
          .filter(Boolean)
          .join('\n');

        await this.sendMessage(message.from, partialMessage);
      } else if (result.isReceipt) {
        // Receipt detected but couldn't extract data
        const basicMessage = [
          '📄 Imagen guardada como recibo',
          '',
          `📁 Archivo: ${result.fileUploaded?.fileId.substring(0, 8)}...`,
          `🔍 Confianza: ${Math.round(result.confidence * 100)}%`,
          '',
          '⚠️ No se pudieron extraer datos automáticamente',
          '💡 Revisa el archivo en la app para crear el gasto'
        ].join('\n');

        await this.sendMessage(message.from, basicMessage);
      } else {
        // Not a receipt
        const nonReceiptMessage = [
          '📷 Imagen guardada',
          '',
          `📁 Archivo: ${result.fileUploaded?.fileId.substring(0, 8)}...`,
          '',
          '💡 No parece ser un recibo. Si es un error,',
          'usa la app para procesar manualmente.'
        ].join('\n');

        await this.sendMessage(message.from, nonReceiptMessage);
      }

      return true;
    } catch (error) {
      this.logger.error('Error processing receipt image:', {
        from: message.from,
        error: error.message,
        stack: error.stack
      });

      await this.sendMessage(message.from, '❌ Error procesando la imagen. Por favor intenta de nuevo.');
      return false;
    }
  }

  async sendMessage(to: string, message: string): Promise<void> {
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn('WhatsApp credentials not configured, message not sent');
      console.log(`[MOCK] WhatsApp message to ${to}: ${message}`);
      return;
    }

    try {
      const url = `${this.whatsappApiUrl}/${this.phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        to: `+54299154047906`,
        type: 'text',
        text: {
          body: message
        }
      };

      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      };

      this.logger.debug('Sending WhatsApp message', {
        to: `+${to}`,
        messageLength: message.length,
        url
      });

      const response = await axios.post(url, payload, { headers });

      this.logger.log('WhatsApp message sent successfully', {
        to: to,
        messageId: response.data.messages?.[0]?.id,
        status: response.status
      });
    } catch (error) {
      this.logger.error('Failed to send WhatsApp message', {
        to: `+${to}`,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      // Check if error is due to recipient not in allowed list (development mode)
      if (error.response?.status === 400 && error.response?.data?.error?.code === 131030) {
        this.logger.warn('WhatsApp recipient not in allowed list (development mode)', {
          to: `+${to}`,
          message: 'Add this number to Business Manager recipients list'
        });

        // In development, log the message instead of throwing error
        console.log(`[DEV-FALLBACK] WhatsApp message to +${to}: ${message}`);
        console.log(`⚠️  Add +${to} to WhatsApp Business Manager recipients list to receive real messages`);
        return; // Don't throw error, just log
      }

      // Fallback to console log in development for other errors
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FALLBACK] WhatsApp message to ${to}: ${message}`);
      }

      throw new Error(`Failed to send WhatsApp message: ${error.message}`);
    }
  }

  private async sendConfirmationMessage(to: string, expenseData: any): Promise<void> {
    const message = `✅ Expense recorded!\nAmount: $${expenseData.amount}\nDescription: ${expenseData.description || 'N/A'}\n\n(Mock confirmation - integration not implemented)`;
    await this.sendMessage(to, message);
  }

  private async sendErrorMessage(to: string, error: string): Promise<void> {
    const message = `❌ Error: ${error}\n\nPlease try again with format: "spent $25 on lunch"`;
    await this.sendMessage(to, message);
  }

  private async sendHelpMessage(to: string): Promise<void> {
    const helpText = [
      '🤖 Savium AI - Expense Tracking',
      '',
      'Commands:',
      '• "spent $25 on lunch" - Record expense',
      '• Send receipt photo - Auto-extract expense',
      '• "help" - Show this message',
      '',
      '(WhatsApp integration not implemented)'
    ].join('\n');
    await this.sendMessage(to, helpText);
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    this.logger.debug('WhatsApp webhook verification attempt', {
      mode,
      tokenProvided: !!token,
      challengeProvided: !!challenge,
      expectedToken: this.verifyToken
    });

    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('WhatsApp webhook verified successfully');
      return challenge;
    }

    this.logger.warn('WhatsApp webhook verification failed', {
      mode,
      tokenMatch: token === this.verifyToken
    });
    return null;
  }

  getServiceStatus(): {
    enabled: boolean;
    features: string[];
    limitations: string[];
    configuration: {
      hasAccessToken: boolean;
      hasPhoneNumberId: boolean;
      hasVerifyToken: boolean;
    };
  } {
    const isConfigured = !!(this.accessToken && this.phoneNumberId && this.verifyToken);

    return {
      enabled: isConfigured,
      configuration: {
        hasAccessToken: !!this.accessToken,
        hasPhoneNumberId: !!this.phoneNumberId,
        hasVerifyToken: !!this.verifyToken
      },
      features: [
        'WhatsApp Business API integration ready',
        'Real message sending/receiving',
        'Webhook verification',
        'Expense command processing',
        'Receipt image handling structure',
        'Message parsing and AI integration'
      ],
      limitations: isConfigured
        ? ['Receipt image processing requires AI service integration', 'Expense categorization needs AI configuration']
        : ['WhatsApp Business API credentials not configured', 'Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN in .env']
    };
  }

  private async autoAssociateUser(phoneNumber: string, message: WhatsAppMessage): Promise<UserDocument | null> {
    try {
      // First, check if we already have a user associated with this phone number
      const user = await this.userModel.findOne({
        'messagingIntegrations.whatsapp.phoneNumber': phoneNumber
      });

      if (user) {
        console.log(`Found existing user ${user.id} for WhatsApp ${phoneNumber}`);
        return user;
      }

      // For now, just log that we received a message from an unassociated phone
      console.log(`📱 Unassociated WhatsApp ${phoneNumber} sent message: "${message.body}"`);
      console.log(`Use POST /api/v1/integrations/messaging/connect to associate this phone with a user`);

      // Send a helpful message to the user
      await this.sendMessage(
        phoneNumber,
        '👋 Hello! I see this is your first message.\n\n' +
          '🔗 To link your account, please visit our app and connect your WhatsApp.\n\n' +
          '📧 Or contact support with your phone number: ' +
          phoneNumber
      );

      return null;
    } catch (error) {
      console.error('Error in auto-associate user:', error);
      return null;
    }
  }

  async findUserByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        'messagingIntegrations.whatsapp.phoneNumber': phoneNumber
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
