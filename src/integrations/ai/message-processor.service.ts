import { getProfileType, getTypedProfile } from '@common/utils/types';
import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { Category, CategoryDocument } from 'src/categories/schemas/category.schema';
import { FinancialProfilesService } from 'src/financial-profiles/financial-profiles.service';
import { AnyProfileDocument, BaseProfile } from 'src/financial-profiles/schemas';
import { CreateTransactionDto } from 'src/transactions/dto/create-transaction.dto';
import { TransactionDocument } from 'src/transactions/schemas/transaction.schema';
import { TransactionsService } from '../../transactions/transactions.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';
import { AiService, IAMsgAnswer } from './ai.service';

export interface UnifiedMessage {
  from: string;
  body: string;
  timestamp: Date | null;
  mediaUrl?: string;
  mediaType: 'text' | 'image' | 'document' | 'audio';
  platform: 'telegram' | 'whatsapp';
  chatId?: string;
  messageId?: string;
  userDefaultCurrency?: string; // User's default currency from preferences
  user: UserDocument; // Full user object to avoid extra query
}

export interface MessageSentToIA {
  msg: string;
  defaultCurrency: string;
  categories: {
    name: string;
    id: string | Types.ObjectId;
  }[];
}

export interface ProcessedMessageResponse {
  success: boolean;
  responseText: string;
  actionTaken?: {
    type: 'income_created' | 'transaction_created' | 'general_response';
  };
  error?: string;
}

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly transactionsService: TransactionsService,
    private readonly financialService: FinancialProfilesService
  ) {}

  async processMessage(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    this.logger.log(`🤖 Processing ${message.platform} message from ${message.from}:`, {
      mediaType: message.mediaType,
      bodyLength: message.body?.length || 0,
      hasMedia: !!message.mediaUrl
    });

    const isChangingProfile = message.body?.includes('@');
    if (isChangingProfile) {
      const profileType = getProfileType(message.body);
      if (profileType) {
        const newProfile = await this.financialService.getProfile(message.user[profileType], message.user._id as string, profileType);
        if (!newProfile) {
          return {
            success: false,
            responseText: `You don't have a profile: ${profileType}`
          };
        }

        message.user.activeProfileRef = newProfile as AnyProfileDocument;
        message.user.activeProfileType = profileType;
      }
    }

    try {
      // Route to appropriate handler based on message type
      switch (message.mediaType) {
        /*        case 'image':
                 return this.processImageMessage(message);
               case 'document':
                 return this.processDocumentMessage(message);
               case 'audio':
                 return this.processAudioMessage(message); */
        case 'text':
        default:
          return this.processTextMessage(message);
      }
    } catch (error) {
      this.logger.error('Error processing message:', error);
      return {
        success: false,
        error: error.message,
        responseText: '❌ Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.'
      };
    }
  }

  private async processTextMessage(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    const activeProfile = message.user.activeProfileRef as AnyProfileDocument;
    // Get user categories from the user document
    const userCategories = (activeProfile.categories as CategoryDocument[]).map((category: CategoryDocument) => ({
      name: category.name,
      id: category._id as string | Types.ObjectId
    }));

    const msg: MessageSentToIA = {
      msg: message.body,
      defaultCurrency: activeProfile.currency,
      categories: userCategories
    };
    // Use AI to analyze the message for transactions
    const aiResult: IAMsgAnswer | undefined = await this.aiService.processTextMessage(msg);
    console.log('IA MESSGE: ', aiResult);
    // Handle transaction creation if complete data is available
    if (aiResult?.trx) {
      return await this.processTransactionFromAI(message, aiResult, activeProfile._id as string);
    }

    // Handle clarification requests (e.g., asking for payment method)
    if (aiResult?.actionTaken?.type === 'CLARIFICATION') {
      return {
        success: true,
        responseText: aiResult.msg,
        actionTaken: {
          type: 'general_response' // Keep as general_response for backward compatibility
        }
      };
    }

    // Handle all other responses
    return {
      success: true,
      responseText: aiResult?.msg || '',
      actionTaken: {
        type: 'general_response'
      }
    };
  }

  // Procesar transacción detectada por IA
  private async processTransactionFromAI(message: UnifiedMessage, aiResult: IAMsgAnswer, activeProfile: string): Promise<ProcessedMessageResponse> {
    this.logger.log('AI detected transaction:', aiResult);

    const isIncome = aiResult.trx!.type === 'income';
    const transactionType = isIncome ? 'ingreso' : 'gasto';
    const emoji = isIncome ? '💰' : '💸';

    try {
      // Create transaction using TransactionsService
      const trxData: CreateTransactionDto = {
        amount: aiResult.trx!.amount,
        description: aiResult.trx!.description || 'Gasto desde mensaje',
        date: new Date(),
        ...(aiResult.trx!.categoryId && { categoryId: aiResult.trx!.categoryId }),
        profileId: activeProfile, // Use profileId instead of accountId
        currency: aiResult.trx!.currency || (message.user.activeProfileRef as AnyProfileDocument).currency,
        isRecurring: aiResult.trx!.isRecurring || false,
        ...(aiResult.trx!.installments && { installments: aiResult.trx!.installments }),
        metadata: {
          source: 'messaging_ai',
          platform: message.platform,
          confidence: aiResult.trx!.confidence,
          aiAnalysis: aiResult.trx!,
          installmentInfo: aiResult.trx!.installmentInfo
        }
      };

      const transactions: TransactionDocument[] = await this.transactionsService.create(trxData);

      return {
        success: true,
        responseText: aiResult.msg,
        actionTaken: {
          type: isIncome ? 'income_created' : 'transaction_created'
        }
      };
    } catch (error) {
      this.logger.error('Failed to create transaction from AI message', {
        error: error.message,
        aiResult,
        platform: message.platform,
        userId: message.user._id
      });

      return {
        success: false,
        responseText:
          `❌ Lo siento, hubo un error guardando tu ${transactionType}. Los datos fueron detectados correctamente, pero no pude guardarlos en tu cuenta. Por favor intenta de nuevo.`,
        error: error.message,
        actionTaken: {
          type: 'general_response'
        }
      };
    }
  }

  // Procesar comandos detectados por IA
  /*  private async processAICommand(message: UnifiedMessage, commandResult: any, userCategories: [{ name: string, id: string; }]): Promise<ProcessedMessageResponse> {
     this.logger.log('AI detected command:', commandResult);

     switch (commandResult.commandType) {
       case 'transaction':
       case 'income':
         // For transaction/income commands, re-process as transaction
         const aiResult = await this.aiService.processTextMessage(message.body, userCategories);
         if (aiResult.hasTransaction) {
           return this.processTransactionFromAI(message, aiResult);
         }
         // Fallback if transaction not detected
         return {
           success: true,
           responseText: '💸 Entiendo que quieres registrar un gasto, pero no pude extraer el monto. ¿Puedes decirme cuánto gastaste y en qué?',
           actionTaken: { type: 'general_response' }
         };
       case 'export':
         return this.processExportCommand(message, commandResult.details);
       case 'balance':
         return this.processBalanceCommand(message, commandResult.details);
       case 'report':
         return this.processReportCommand(message, commandResult.details);
       case 'budget':
         return this.processBudgetCommand(message, commandResult.details);
       case 'help':
         return this.processHelpQuery(message);
       default:
         return {
           success: true,
           responseText: '🤖 Entiendo que quieres hacer algo, pero no estoy seguro qué. ¿Puedes ser más específico?',
           actionTaken: { type: 'general_response' }
         };
     }
   } */
}
