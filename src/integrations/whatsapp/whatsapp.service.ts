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
import { ExpensesService } from '../../expenses/expenses.service';
import { AccountsService } from '../../accounts/accounts.service';
import { RequestContextService } from '@common/interceptors/request-context';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-codes';

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
    private receiptProcessorService: ReceiptProcessorService,
    private expensesService: ExpensesService,
    private accountsService: AccountsService
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
    const traceId = RequestContextService.getTraceId() || `webhook_${Date.now()}`;

    try {
      // Validate webhook payload structure
      if (!payload || typeof payload !== 'object') {
        this.logger.warn('Invalid webhook payload: not an object', { traceId });
        return { processed: false, message: 'Invalid payload structure' };
      }

      if (!payload.entry || !Array.isArray(payload.entry) || payload.entry.length === 0) {
        this.logger.warn('Invalid webhook payload: missing or empty entry array', { traceId });
        return { processed: false, message: 'Missing entry data' };
      }

      // Process each entry
      let messagesProcessed = 0;
      for (const entry of payload.entry) {
        if (!entry.changes || !Array.isArray(entry.changes)) {
          continue;
        }

        for (const change of entry.changes) {
          if (!change.value?.messages || !Array.isArray(change.value.messages)) {
            continue;
          }

          for (const message of change.value.messages) {
            try {
              // Validate message structure
              if (!message.from || !message.timestamp) {
                this.logger.warn('Invalid message structure in webhook', {
                  messageId: message.id,
                  traceId
                });
                continue;
              }

              await this.processMessage({
                from: message.from,
                body: message.text?.body || message.caption || '',
                timestamp: new Date(parseInt(message.timestamp) * 1000),
                mediaUrl: message.image?.id || message.document?.id || message.audio?.id,
                mediaType: message.type || 'text'
              });

              messagesProcessed++;
            } catch (error) {
              this.logger.error('Error processing individual message from webhook', {
                messageId: message.id,
                error: error.message,
                traceId
              });
            }
          }
        }
      }

      this.logger.log('Webhook processed successfully', {
        messagesProcessed,
        traceId
      });

      return {
        processed: true,
        message: `Processed ${messagesProcessed} messages`
      };
    } catch (error) {
      this.logger.error('Error processing webhook payload', {
        error: error.message,
        stack: error.stack,
        traceId
      });

      return {
        processed: false,
        message: 'Internal processing error'
      };
    }
  }

  async processMessage(message: WhatsAppMessage): Promise<void> {
    const traceId = RequestContextService.getTraceId() || `whatsapp_${Date.now()}`;

    this.logger.log('📱 WhatsApp message received:', {
      from: this.maskPhoneNumber(message.from),
      body: message.body?.substring(0, 100), // Limit body length in logs
      timestamp: message.timestamp,
      hasMedia: !!message.mediaUrl,
      mediaType: message.mediaType,
      traceId
    });

    try {
      // First, try to find user by phone number
      const user = await this.findUserByPhoneNumber(message.from);

      if (!user) {
        await this.handleUnknownUser(message.from, message.body, traceId);
        return;
      }

      // Set user context for request tracing
      RequestContextService.updateContext({ userId: user.id });

      // Get user's language preference for responses
      const userLanguage = user.preferences?.display?.language || 'es';

      // Convert WhatsApp message to unified format
      const unifiedMessage: UnifiedMessage = {
        from: message.from,
        body: message.body || '',
        timestamp: message.timestamp,
        mediaUrl: message.mediaUrl,
        mediaType: this.mapMediaType(message.mediaType),
        platform: 'whatsapp',
        chatId: message.from, // For WhatsApp, phone number acts as chat ID
        messageId: `whatsapp_${traceId}`,
        userId: user.id
      };

      // Process message with centralized AI service
      const result = await this.messageProcessor.processMessage(unifiedMessage);

      if (result.success && result.responseText) {
        // Translate response to user's language if needed
        const responseText = await this.translateResponse(result.responseText, userLanguage);
        await this.sendMessage(message.from, responseText);

        // Log the action taken
        if (result.actionTaken) {
          this.logger.log(`Action taken for WhatsApp message: ${result.actionTaken.type}`, {
            from: this.maskPhoneNumber(message.from),
            userId: user.id,
            actionType: result.actionTaken.type,
            traceId
          });
        }
      } else if (result.error) {
        const errorMessage = await this.translateResponse(result.responseText || 'Hubo un error procesando tu mensaje.', userLanguage);
        await this.sendMessage(message.from, errorMessage);
      }
    } catch (error) {
      this.logger.error('Error processing WhatsApp message:', {
        error: error.message,
        stack: error.stack,
        from: this.maskPhoneNumber(message.from),
        traceId
      });

      // Send generic error message in Spanish by default
      await this.sendMessage(message.from, '❌ Lo siento, hubo un problema procesando tu mensaje. Por favor intenta de nuevo.');
    }
  }

  // Public method for sending custom messages (used by AI service)
  async respondWithCustomMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      await this.sendMessage(phoneNumber, message);
      return true;
    } catch (error) {
      this.logger.error('Error sending WhatsApp message:', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        error: error.message
      });
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


  async sendMessage(to: string, message: string): Promise<void> {
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn('WhatsApp credentials not configured, message not sent', {
        to: this.maskPhoneNumber(to),
        messageLength: message?.length || 0
      });
      return;
    }

    try {
      const url = `${this.whatsappApiUrl}/${this.phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        to: to,
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
        to: this.maskPhoneNumber(to),
        messageLength: message.length,
        url
      });

      const response = await axios.post(url, payload, { headers });

      this.logger.log('WhatsApp message sent successfully', {
        to: this.maskPhoneNumber(to),
        messageId: response.data.messages?.[0]?.id,
        status: response.status
      });
    } catch (error) {
      this.logger.error('Failed to send WhatsApp message', {
        to: this.maskPhoneNumber(to),
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      // Check if error is due to recipient not in allowed list (development mode)
      if (error.response?.status === 400 && error.response?.data?.error?.code === 131030) {
        this.logger.warn('WhatsApp recipient not in allowed list (development mode)', {
          to: this.maskPhoneNumber(to),
          message: 'Add this number to Business Manager recipients list'
        });

        // In development, log the message instead of throwing error
        this.logger.warn('[DEV-FALLBACK] WhatsApp message sent to console due to recipient restrictions', {
          to: this.maskPhoneNumber(to),
          messageLength: message?.length || 0,
          suggestion: 'Add number to WhatsApp Business Manager recipients list'
        });
        return; // Don't throw error, just log
      }

      // Fallback logging in development for other errors
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug('[FALLBACK] WhatsApp message failed, logged for development', {
          to: this.maskPhoneNumber(to),
          messageLength: message?.length || 0,
          errorStatus: error.response?.status
        });
      }

      throw new Error(`Failed to send WhatsApp message: ${error.message}`);
    }
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

  private async handleUnknownUser(phoneNumber: string, messageBody: string, traceId: string): Promise<void> {
    try {
      this.logger.warn('Unregistered WhatsApp user attempted contact', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        messageBody: messageBody?.substring(0, 100),
        traceId
      });

      // Send helpful message in Spanish and English
      const helpMessage = [
        '👋 ¡Hola! Parece que es tu primer mensaje.',
        '',
        '🔗 Para vincular tu cuenta:',
        '1. Descarga la app Savium',
        '2. Crea tu cuenta o inicia sesión',
        '3. Ve a Configuración > Integraciones',
        '4. Conecta tu WhatsApp',
        '',
        '📧 ¿Necesitas ayuda? Contacta soporte con tu número:',
        phoneNumber,
        '',
        '---',
        '',
        '👋 Hello! This seems to be your first message.',
        '',
        '🔗 To link your account:',
        '1. Download the Savium app',
        '2. Create your account or sign in',
        '3. Go to Settings > Integrations',
        '4. Connect your WhatsApp',
        '',
        '📧 Need help? Contact support with your number:',
        phoneNumber
      ].join('\n');

      await this.sendMessage(phoneNumber, helpMessage);

      // TODO: Optionally create a lead/prospect record for marketing follow-up
      // await this.marketingService.createProspect({ phoneNumber, source: 'whatsapp' });
    } catch (error) {
      this.logger.error('Error handling unknown user:', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        error: error.message,
        traceId
      });
    }
  }

  async findUserByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    try {
      // Clean the phone number (remove non-digits, ensure + prefix)
      const cleanedPhoneNumber = this.cleanPhoneNumber(phoneNumber);
      const phoneWithoutPlus = cleanedPhoneNumber.startsWith('+') ? cleanedPhoneNumber.substring(1) : cleanedPhoneNumber;
      const phoneWithPlus = cleanedPhoneNumber.startsWith('+') ? cleanedPhoneNumber : '+' + cleanedPhoneNumber;

      // Single query with $or operator for all lookup strategies with timeout
      const user = await Promise.race([
        this.userModel.findOne({
          $or: [
            { 'messagingIntegrations.whatsapp.phoneNumber': cleanedPhoneNumber },
            { phoneNumber: cleanedPhoneNumber },
            { phoneNumber: phoneWithoutPlus },
            { phoneNumber: phoneWithPlus }
          ]
        }).populate('activeProfile').exec(),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Database query timeout')), 5000)
        )
      ]);

      if (user) {
        this.logger.log('User found by phone number', {
          phoneNumber: this.maskPhoneNumber(cleanedPhoneNumber),
          userId: user.id
        });
        return user;
      }

      this.logger.warn('No user found for phone number', {
        phoneNumber: this.maskPhoneNumber(cleanedPhoneNumber)
      });

      return null;
    } catch (error) {
      // Handle specific database errors
      if (error.name === 'MongooseError' || error.name === 'MongoError') {
        this.logger.error('Database error during user lookup:', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          error: error.message,
          errorType: error.name
        });
      } else if (error.message === 'Database query timeout') {
        this.logger.error('Database query timeout during user lookup:', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          timeout: '5000ms'
        });
      } else {
        this.logger.error('Unexpected error finding user by phone number:', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          error: error.message,
          stack: error.stack
        });
      }

      return null;
    }
  }

  /**
   * Gets the active account ID for a user based on their active profile
   * Falls back to first account if no active profile or associated accounts
   */
  private async getUserActiveAccountId(user: UserDocument): Promise<string | null> {
    try {
      // First, try to get the active profile and its associated accounts
      if (user.activeProfileId) {
        const activeProfile = await Promise.race([
          this.userProfileModel.findById(user.activeProfileId),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Database query timeout')), 3000)
          )
        ]);

        if (activeProfile && activeProfile.associatedAccounts?.length > 0) {
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
      // Handle specific database errors
      if (error.name === 'MongooseError' || error.name === 'MongoError') {
        this.logger.error('Database error getting user active account ID:', {
          userId: user.id,
          error: error.message,
          errorType: error.name
        });
      } else if (error.message === 'Database query timeout') {
        this.logger.error('Database timeout getting user active account ID:', {
          userId: user.id,
          timeout: '3000ms'
        });
      } else {
        this.logger.error('Unexpected error getting user active account ID:', {
          userId: user.id,
          error: error.message,
          stack: error.stack
        });
      }

      // Fallback to user's first account if profile lookup fails
      if (user.accounts && user.accounts.length > 0) {
        this.logger.warn('Falling back to first account due to profile lookup error', {
          userId: user.id
        });
        return user.accounts[0].toString();
      }

      return null;
    }
  }

  /**
   * Clean and normalize phone number for consistent lookup
   */
  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Ensure it starts with + for international format
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  /**
   * Mask phone number for privacy in logs
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length < 4) {
      return '***';
    }

    // Show first 3 characters and last 3, mask the middle
    const start = phoneNumber.substring(0, 3);
    const end = phoneNumber.substring(phoneNumber.length - 3);
    const middle = '*'.repeat(Math.max(0, phoneNumber.length - 6));

    return `${start}${middle}${end}`;
  }

  /**
   * Translate response to user's preferred language
   */
  private async translateResponse(text: string, targetLanguage: string): Promise<string> {
    // For now, return text as-is since most responses are already in Spanish
    // TODO: Implement actual translation service integration (Google Translate, DeepL, etc.)

    if (targetLanguage === 'en') {
      // Enhanced translation map for common WhatsApp responses
      const translations: Record<string, string> = {
        // General terms
        'gasté': 'spent',
        'gasto': 'expense',
        'creado': 'created',
        'procesando': 'processing',
        'recibido': 'received',
        'guardado': 'saved',
        'analizado': 'analyzed',
        'detectado': 'detected',

        // Error messages
        'Hubo un error': 'There was an error',
        'Lo siento': 'Sorry',
        'Por favor intenta': 'Please try',
        'de nuevo': 'again',

        // Success messages
        'exitosamente': 'successfully',
        '¡Perfecto!': 'Perfect!',
        '¡Excelente!': 'Excellent!',

        // Categories and amounts
        'Monto': 'Amount',
        'Descripción': 'Description',
        'Categoría': 'Category',
        'Confianza': 'Confidence',

        // Instructions
        'Revisa la app': 'Check the app',
        'Crea una cuenta': 'Create an account',
        'Conecta tu WhatsApp': 'Connect your WhatsApp'
      };

      let translatedText = text;
      for (const [spanish, english] of Object.entries(translations)) {
        translatedText = translatedText.replace(new RegExp(spanish, 'gi'), english);
      }

      return translatedText;
    }

    return text;
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
