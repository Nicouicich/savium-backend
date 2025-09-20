import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AI_PROMPT } from './prompts/ai-prompts';
import { MessageSentToIA } from './message-processor.service';

export interface TicketProcessingResult {
  type?: 'transaction' | 'income';
  amount?: number;
  vendor?: string;
  date?: Date;
  description?: string;
  suggestedCategory?: string;
  confidence?: number;
  extractedText?: string;
  isRecurring?: boolean;
  installments?: number;
  installmentInfo?: string;
}

export interface AudioTranscriptionResult {
  transcription: string;
  language?: string;
  confidence?: number;
  processedTransaction?: {
    type?: 'transaction' | 'income';
    amount?: number;
    description?: string;
    category?: string;
    isRecurring?: boolean;
    installments?: number;
    installmentInfo?: string;
  };
}

export enum IAAction {
  trx = 'TRANSACTION',
  image = 'IMAGE',
  response = 'RESPONSE',
  g_response = 'GENERAL_RESPONSE',
  export = 'EXPORT',
  report = 'REPORT',
  clarification = 'CLARIFICATION'
}
export enum IAActionData {
  balance = 'balance',
  trx = 'trx',
  incompleteTrx = 'incomplete_trx',
  needsMethod = 'needs_method',
  needsAmount = 'needs_amount'
}

export interface IAMsgAnswer {
  trx?: {
    type: 'transaction' | 'income';
    amount: number;
    description: string;
    date: Date;
    currency: string;
    method?: string;
    categoryId?: string;
    isRecurring?: boolean;
    installments?: number;
    installmentInfo?: string;
    confidence?: number;
  };
  msg: string; // MESSAGE FOR THE USER, IN CASE YOU NEED CLARIFICATION, FOR EXAMPLE PAYMENT METHOD. IF ALL IS GOOD YOU RESPOND WITH A SUCCESS MESSAGE LIKE THE TRANSACTION WAS ADDED. YOU DON'T SEND A TRX IF IMPORTANT DATA IS MISSING
  actionTaken: {
    type: IAAction;
    data?: IAActionData;
  };
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reasoning: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.isEnabled = Boolean(apiKey && apiKey !== 'placeholder-openai-key' && apiKey !== 'sk-test-mock-key-for-development');

    if (this.isEnabled) {
      try {
        this.openai = new OpenAI({
          apiKey
        });
        this.logger.log('OpenAI client initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize OpenAI client:', error);
        this.isEnabled = false;
      }
    } else {
      this.logger.warn('OpenAI API key not configured - AI features disabled');
    }
  }

  // Utility method to check if AI features are enabled
  isAiEnabled(): boolean {
    return this.isEnabled;
  }

  // Método optimizado para procesar mensajes de texto con mínimos tokens
  async processTextMessage(message: MessageSentToIA): Promise<IAMsgAnswer | undefined> {
    if (!this.openai) return;
    try {
      const msg = JSON.stringify(message);
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: AI_PROMPT
          },
          {
            role: 'user',
            content: msg
          }
        ],
        max_tokens: 250, // Increased slightly to accommodate CLARIFICATION responses
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      console.log('MEESAGE FROM IA', content);
      let clean = content?.trim() || '';
      if (clean.startsWith('```')) {
        clean = clean
          .replace(/^\`\`\`(json)?/, '')
          .replace(/\`\`\`$/, '')
          .trim();
      }

      return JSON.parse(clean);
    } catch (error) {
      this.logger.error('Error processing text message:', error);
      return;
    }
  }
}
