import { RequestContextService } from '@common/interceptors/request-context';
import { LogFormatter } from '@common/utils/log-formatter';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model } from 'mongoose';
import { AccountsService } from '../../accounts/accounts.service';
import { MessagingFileService } from '../../files/services/messaging-file.service';
import { UserProfile } from '../../users/schemas/user-profile.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { AiService } from '../ai/ai.service';
import { MessageProcessorService, UnifiedMessage } from '../ai/message-processor.service';
import { ReceiptProcessorService } from '../ai/receipt-processor.service';
import { WhatsAppMessageDto, WhatsAppWebhookDto } from './dto/whatsapp-webhook.dto';
import { UsersService } from 'src/users/users.service';
import { TransactionsService } from 'src/transactions/transactions.service';

interface WhatsAppMessage {
  from: string;
  body: string;
  timestamp: Date | null;
  mediaUrl?: string;
  mediaType?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly whatsappApiUrl = 'https://graph.facebook.com/v17.0';
  private readonly accessToken: string | undefined;
  private readonly phoneNumberId: string | undefined;
  private readonly verifyToken: string | undefined;

  constructor (
    private configService: ConfigService,
    private messageProcessor: MessageProcessorService,
    private userService: UsersService,

    private messagingFileService: MessagingFileService,
    private receiptProcessorService: ReceiptProcessorService,
    private transactionsService: TransactionsService,
    private accountsService: AccountsService,
    private aiService: AiService
  ) {
    this.accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN');
    this.phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');
    this.verifyToken = this.configService.get('WHATSAPP_VERIFY_TOKEN');

    this.logger.debug(
      LogFormatter.format('WhatsApp service initialized', {
        hasAccessToken: !!this.accessToken,
        hasPhoneNumberId: !!this.phoneNumberId,
        hasVerifyToken: !!this.verifyToken
      })
    );
  }

  async handleWebhook(payload: WhatsAppWebhookDto): Promise<void> {
    const traceId = RequestContextService.getTraceId() || `webhook_${Date.now()}`;

    const messages = payload.getMessages();
    if (!messages) return;
    await Promise.all(
      messages.map((message: WhatsAppMessageDto) => {
        if (!message) return;
        try {
          this.processMessage({
            from: message.from,
            body: message.text?.body || message.caption || '',
            timestamp: message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : null,
            mediaUrl: message.image?.id || message.document?.id || message.audio?.id,
            mediaType: message.type || 'text'
          });
        } catch (error) {
          this.logger.error({ error, traceId });
        }
      })
    );
  }

  async processMessage(message: WhatsAppMessage): Promise<void> {
    const traceId = RequestContextService.getTraceId() || `whatsapp_${Date.now()}`;

    this.logger.log(
      LogFormatter.whatsappMessage('📱 WhatsApp message received', {
        from: this.maskPhoneNumber(message.from),
        body: message.body,
        timestamp: message.timestamp,
        hasMedia: !!message.mediaUrl,
        mediaType: message.mediaType,
        traceId
      })
    );

    try {
      // First, try to find user by phone number
      const user: UserDocument | null = await this.userService.getFullUserDataByPhoneNumber(`+${message.from}`);

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
        userDefaultCurrency: user.preferences.display.currency,
        user: user // Pass the full user object to avoid extra query
      };

      // TODO: Temporarily commented out for testing WhatsApp without AI
      // Process message with centralized AI service

      const result = await this.messageProcessor.processMessage(unifiedMessage);
      if (result.success && result.responseText) {
        // AI already responds in user's language, no translation needed
        await this.sendMessage(`+${'54299154047906'}`, result.responseText);

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
        // Send error message (AI should have provided responseText)
        const errorMessage = result.responseText || '❌ Lo siento, hubo un problema procesando tu mensaje. Por favor intenta de nuevo.';
        await this.sendMessage(`+${'54299154047906'}`, errorMessage);
      }

      // Simple test response for WhatsApp testing
      /*       const testResponse = `✅ ¡Hola Nico! Mensaje recibido: "${message.body}" - WhatsApp funciona correctamente 🚀`;
      await this.sendMessage('+54299154047906', testResponse); */

      this.logger.log('WhatsApp test response sent', {
        from: this.maskPhoneNumber(message.from),
        userId: user.id,
        messageReceived: message.body,
        traceId
      });
    } catch (error) {
      console.log(error);
      this.logger.error('Error processing WhatsApp message:', {
        error: error.message,
        stack: error.stack,
        from: this.maskPhoneNumber(message.from),
        traceId
      });

      // Send generic error message in Spanish by default
      await this.sendMessage(`+${'54299154047906'}`, '❌ Lo siento, hubo un problema procesando tu mensaje. Por favor intenta de nuevo.');
    }
  }

  // Public method for sending custom messages (used by AI service)
  async respondWithCustomMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      await this.sendMessage('+54299154047906', message);
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
      // Format phone number for WhatsApp (adds "15" for Argentina)
      const whatsappFormattedPhone = this.formatPhoneForWhatsApp(to);

      const url = `${this.whatsappApiUrl}/${this.phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        to: whatsappFormattedPhone,
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
        originalPhone: this.maskPhoneNumber(to),
        whatsappPhone: this.maskPhoneNumber(whatsappFormattedPhone),
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
      this.logger.error(
        LogFormatter.apiOperation('Failed to send WhatsApp message', {
          to: this.maskPhoneNumber(to),
          error: error.message,
          status: error.response?.status
        })
      );

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
        this.logger.debug(
          LogFormatter.apiOperation('[FALLBACK] WhatsApp message failed, logged for development', {
            to: this.maskPhoneNumber(to),
            messageLength: message?.length || 0,
            errorStatus: error.response?.status
          })
        );
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
        'Transaction command processing',
        'Receipt image handling structure',
        'Message parsing and AI integration'
      ],
      limitations: isConfigured
        ? ['Receipt image processing requires AI service integration', 'Transaction categorization needs AI configuration']
        : ['WhatsApp Business API credentials not configured', 'Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN in .env']
    };
  }

  private async handleUnknownUser(phoneNumber: string, messageBody: string, traceId: string): Promise<void> {
    try {
      this.logger.warn(
        LogFormatter.userOperation('Unregistered WhatsApp user attempted contact', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          traceId
        })
      );

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

      await this.sendMessage('+54299154047906', helpMessage);

      // TODO: Optionally create a lead/prospect record for marketing follow-up
      // await this.marketingService.createProspect({ phoneNumber, source: 'whatsapp' });
    } catch (error) {
      this.logger.error(
        LogFormatter.userOperation('Error handling unknown user', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          traceId
        })
      );
    }
  }

  /**
   * Format phone number for WhatsApp sending - add '15' for Argentina mobile numbers
   */
  private formatPhoneForWhatsApp(phoneNumber: string): string {
    // Simple phone number cleaning
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    // Handle Argentina phone numbers: WhatsApp API requires "15" for mobile numbers
    // Convert +54299154047906 to +5429915404790 for sending
    if (cleaned.startsWith('+542') && cleaned.length === 13) {
      // Add the "15" prefix: +54299154047906 -> +5429915404790
      const areaCode = cleaned.substring(3, 6); // "299"
      const phoneNumber = cleaned.substring(6); // "4047906"
      const whatsappFormat = `+549${areaCode}15${phoneNumber}`;

      this.logger.debug('Argentina phone formatting for WhatsApp', {
        original: cleaned,
        whatsappFormat: whatsappFormat
      });

      return whatsappFormat;
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
    return phoneNumber;
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
        gasté: 'spent',
        gasto: 'transaction',
        creado: 'created',
        procesando: 'processing',
        recibido: 'received',
        guardado: 'saved',
        analizado: 'analyzed',
        detectado: 'detected',

        // Error messages
        'Hubo un error': 'There was an error',
        'Lo siento': 'Sorry',
        'Por favor intenta': 'Please try',
        'de nuevo': 'again',

        // Success messages
        exitosamente: 'successfully',
        '¡Perfecto!': 'Perfect!',
        '¡Excelente!': 'Excellent!',

        // Categories and amounts
        Monto: 'Amount',
        Descripción: 'Description',
        Categoría: 'Category',
        Confianza: 'Confidence',

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

  private extractTransactionData(text: string): { amount?: number; description?: string; } {
    // Parse transaction from text like "25 lunch" or "spent 30 on groceries" or "gasté 45 en cena"
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
          description: match[2]?.trim() || 'Transaction'
        };
      }
    }

    return {};
  }
}
