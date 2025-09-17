import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AI_PROMPTS, buildCompactCategorizationPrompt, buildCompactReceiptPrompt, buildCompactAudioPrompt, formatUserCategories } from './prompts/ai-prompts';

export interface TicketProcessingResult {
  type?: 'expense' | 'income';
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
    type?: 'expense' | 'income';
    amount?: number;
    description?: string;
    category?: string;
    isRecurring?: boolean;
    installments?: number;
    installmentInfo?: string;
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

  async processTicketImage(imageBuffer: Buffer, mimeType: string): Promise<TicketProcessingResult> {
    if (!this.isEnabled || !this.openai) {
      this.logger.warn('AI processing requested but not enabled - returning mock data');
      return this.getMockTicketProcessingResult();
    }

    try {
      // Convert image buffer to base64
      const base64Image = imageBuffer.toString('base64');
      const imageUrl = `data:${mimeType};base64,${base64Image}`;

      const defaultCategories = ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Hogar', 'Ropa', 'Tecnología', 'Servicios', 'Ingresos', 'Otros'];
      const receiptPrompt = buildCompactReceiptPrompt('', defaultCategories);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: receiptPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const parsed = JSON.parse(content);

      // Convert date string to Date object if present
      if (parsed.date) {
        parsed.date = new Date(parsed.date);
      }

      this.logger.log('Successfully processed ticket image with AI');
      return parsed as TicketProcessingResult;
    } catch (error) {
      this.logger.error('Error processing ticket image:', error);
      // Return fallback result with extracted text attempt
      return {
        confidence: 0.1,
        extractedText: 'Error processing image with AI - please enter details manually'
      };
    }
  }

  async categorizeExpense(description: string, amount: number, userCategories: string[], vendor?: string): Promise<CategorySuggestion[]> {
    if (!this.isEnabled || !this.openai) {
      this.logger.warn('AI categorization requested but not enabled - returning mock data');
      return this.getMockCategorySuggestions(description);
    }

    try {
      const expenseText = [`${description}`, `$${amount}`, vendor || ''].filter(Boolean).join(' ');
      const compactPrompt = buildCompactCategorizationPrompt(expenseText, userCategories);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: compactPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const suggestions = JSON.parse(content);

      // Add placeholder categoryId (in real implementation, you'd map category names to IDs)
      const result: CategorySuggestion[] = suggestions.map((suggestion: any, index: number) => ({
        categoryId: `ai_suggestion_${index}`,
        categoryName: suggestion.categoryName,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning
      }));

      this.logger.log(`Successfully categorized expense: ${description}`);
      return result;
    } catch (error) {
      this.logger.error('Error categorizing expense:', error);
      return this.getMockCategorySuggestions(description);
    }
  }

  async analyzeSpendingPatterns(expenses: any[]): Promise<{
    insights: string[];
    recommendations: string[];
    trends: any[];
  }> {
    if (!this.isEnabled || !this.openai || expenses.length === 0) {
      this.logger.warn('AI spending analysis requested but not enabled or no expenses provided');
      return this.getMockSpendingAnalysis();
    }

    try {
      // Prepare expense data for analysis
      const expenseData = expenses.slice(0, 100).map(expense => ({
        amount: expense.amount,
        category: expense.category?.name || 'Other',
        date: expense.date,
        description: expense.description
      }));

      const totalAmount = expenseData.reduce((sum, exp) => sum + exp.amount, 0);
      const categoryTotals = expenseData.reduce(
        (acc, exp) => {
          acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
          return acc;
        },
        {} as Record<string, number>
      );

      const analysisPrompt = `Analyze the following spending data and provide insights and recommendations:

Total Expenses: $${totalAmount.toFixed(2)}
Number of Transactions: ${expenseData.length}

Category Breakdown:
${Object.entries(categoryTotals)
  .map(([category, amount]) => `- ${category}: $${amount.toFixed(2)} (${((amount / totalAmount) * 100).toFixed(1)}%)`)
  .join('\n')}

Recent Transactions (sample):
${expenseData
  .slice(0, 10)
  .map(exp => `- ${exp.date}: $${exp.amount} - ${exp.description} (${exp.category})`)
  .join('\n')}

Provide analysis in JSON format with:
- insights: array of 3-5 key observations about spending patterns
- recommendations: array of 3-5 actionable recommendations
- trends: array of trend observations (spending increases/decreases, seasonal patterns, etc.)`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: AI_PROMPTS.SPENDING_ANALYZER
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const analysis = JSON.parse(content);
      this.logger.log(`Successfully analyzed ${expenses.length} expenses`);
      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing spending patterns:', error);
      return this.getMockSpendingAnalysis();
    }
  }

  async processAudioMessage(audioBuffer: Buffer, mimeType: string): Promise<AudioTranscriptionResult> {
    if (!this.isEnabled || !this.openai) {
      this.logger.warn('AI audio processing requested but not enabled - returning mock data');
      return {
        transcription: 'Transcripción de prueba - IA no configurada',
        confidence: 0.1
      };
    }

    try {
      // Create a temporary file for Whisper
      const fs = require('fs');
      const path = require('path');
      const tempFilePath = path.join(process.cwd(), 'temp', `audio_${Date.now()}.ogg`);

      // Ensure temp directory exists
      const tempDir = path.dirname(tempFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Write audio buffer to temp file
      fs.writeFileSync(tempFilePath, audioBuffer);

      // Transcribe with Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'es', // Spanish by default, can be auto-detected
        response_format: 'json',
        temperature: 0.0
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      const transcribedText = transcription.text;
      this.logger.log(`Audio transcribed: "${transcribedText}"`);

      // Check if transcription contains transaction information
      let processedTransaction;
      if (this.containsTransactionInformation(transcribedText)) {
        processedTransaction = await this.extractTransactionFromText(transcribedText);
      }

      return {
        transcription: transcribedText,
        language: 'es',
        confidence: 0.9, // Whisper is generally very accurate
        processedTransaction
      };
    } catch (error) {
      this.logger.error('Error processing audio with Whisper:', error);

      // Clean up temp file on error
      try {
        const fs = require('fs');
        const path = require('path');
        const tempFilePath = path.join(process.cwd(), 'temp', `audio_${Date.now()}.ogg`);
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return {
        transcription: 'Error procesando audio',
        confidence: 0.0
      };
    }
  }

  private containsTransactionInformation(text: string): boolean {
    const transactionKeywords = [
      // Expense keywords
      'gasté',
      'gaste',
      'spent',
      'compré',
      'compre',
      'pagué',
      'pague',
      'costó',
      'costo',
      'cuesta',
      'precio',
      // Income keywords
      'recibí',
      'me pagaron',
      'cobramos',
      'venta',
      'sueldo',
      'depósito',
      'transferencia',
      'reembolso',
      'ingreso',
      // Currency
      'pesos',
      'dólares',
      'euros'
    ];

    const lowerText = text.toLowerCase();
    const hasTransactionKeyword = transactionKeywords.some(keyword => lowerText.includes(keyword));
    const hasAmount = /\d+/.test(text); // Contains numbers

    return hasTransactionKeyword && hasAmount;
  }

  private async extractTransactionFromText(text: string): Promise<{
    type?: 'expense' | 'income';
    amount?: number;
    description?: string;
    category?: string;
    isRecurring?: boolean;
    installments?: number;
    installmentInfo?: string;
  }> {
    if (!this.isEnabled || !this.openai) {
      return {};
    }

    try {
      const defaultCategories = ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Hogar', 'Ropa', 'Tecnología', 'Servicios', 'Ingresos', 'Otros'];
      const compactPrompt = buildCompactAudioPrompt(text, defaultCategories);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: compactPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {};
      }

      const result = JSON.parse(content.trim());
      if (result.hasTransaction) {
        return {
          type: result.type,
          amount: result.amount,
          description: result.description || (result.type === 'income' ? 'Ingreso desde audio' : 'Gasto desde audio'),
          category: result.category || 'Otros',
          isRecurring: result.isRecurring,
          installments: result.installments,
          installmentInfo: result.installmentInfo
        };
      }

      return {};
    } catch (error) {
      this.logger.error('Error extracting transaction from audio:', error);
      return {};
    }
  }

  async generateBudgetSuggestions(
    historicalExpenses: any[],
    accountType: string
  ): Promise<{
    suggestedBudgets: Array<{
      categoryId: string;
      categoryName: string;
      suggestedAmount: number;
      reasoning: string;
    }>;
  }> {
    if (!this.isEnabled || !this.openai || historicalExpenses.length === 0) {
      this.logger.warn('AI budget suggestions requested but not enabled or no historical data');
      return this.getMockBudgetSuggestions();
    }

    try {
      // Analyze historical expenses for the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const recentExpenses = historicalExpenses.filter(expense => new Date(expense.date) >= sixMonthsAgo);

      const categoryAverages = recentExpenses.reduce(
        (acc, expense) => {
          const category = expense.category?.name || 'Other';
          if (!acc[category]) {
            acc[category] = { total: 0, count: 0 };
          }
          acc[category].total += expense.amount;
          acc[category].count += 1;
          return acc;
        },
        {} as Record<string, { total: number; count: number }>
      );

      const budgetData = Object.entries(categoryAverages)
        .map(([category, data]) => ({
          category,
          monthlyAverage: (data as any).total / 6,
          transactionCount: (data as any).count
        }))
        .sort((a, b) => b.monthlyAverage - a.monthlyAverage);

      const totalMonthlySpending = budgetData.reduce((sum, item) => sum + item.monthlyAverage, 0);

      const budgetPrompt = `Based on the following 6-month spending analysis, suggest monthly budgets for each category:

Account Type: ${accountType}
Total Monthly Average: $${totalMonthlySpending.toFixed(2)}

Category Analysis:
${budgetData.map(item => `- ${item.category}: $${item.monthlyAverage.toFixed(2)}/month (${item.transactionCount} transactions)`).join('\n')}

Consider the account type and provide realistic budget suggestions that allow for:
- 10-20% buffer for unexpected expenses
- Account type specific adjustments (family accounts need more flexibility, business accounts need professional categories)
- Opportunities for savings in high-spending categories

Return JSON with suggestedBudgets array containing:
- categoryName: category name
- suggestedAmount: monthly budget amount
- reasoning: explanation for the budget amount`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content: AI_PROMPTS.BUDGET_ADVISOR
          },
          {
            role: 'user',
            content: budgetPrompt
          }
        ],
        max_tokens: 800,
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const budgetSuggestions = JSON.parse(content);

      // Add placeholder categoryIds
      const result = {
        suggestedBudgets: budgetSuggestions.suggestedBudgets.map((suggestion: any, index: number) => ({
          categoryId: `budget_suggestion_${index}`,
          categoryName: suggestion.categoryName,
          suggestedAmount: suggestion.suggestedAmount,
          reasoning: suggestion.reasoning
        }))
      };

      this.logger.log(`Generated budget suggestions for ${accountType} account with ${historicalExpenses.length} expenses`);
      return result;
    } catch (error) {
      this.logger.error('Error generating budget suggestions:', error);
      return this.getMockBudgetSuggestions();
    }
  }

  // Utility method to check if AI features are enabled
  isAiEnabled(): boolean {
    return this.isEnabled;
  }

  // Método optimizado para procesar mensajes de texto con mínimos tokens
  async processTextMessage(
    message: string,
    userCategories: string[]
  ): Promise<{
    hasTransaction: boolean;
    type?: 'expense' | 'income';
    amount?: number;
    description?: string;
    category?: string;
    isRecurring?: boolean;
    installments?: number;
    installmentInfo?: string;
    confidence?: number;
  }> {
    if (!this.isEnabled || !this.openai) {
      this.logger.warn('AI text processing requested but not enabled');
      return { hasTransaction: false };
    }

    try {
      const compactPrompt = buildCompactCategorizationPrompt(message, userCategories);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: compactPrompt
          }
        ],
        max_tokens: 150, // Mínimo necesario para JSON response
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { hasTransaction: false };
      }

      return JSON.parse(content.trim());
    } catch (error) {
      this.logger.error('Error processing text message:', error);
      return { hasTransaction: false };
    }
  }

  // Método para detectar comandos del usuario
  async detectCommand(message: string): Promise<{
    isCommand: boolean;
    commandType?: 'expense' | 'income' | 'export' | 'balance' | 'help' | 'budget' | 'report' | 'general';
    details?: {
      month?: string;
      year?: string;
      category?: string;
      period?: string;
    };
    confidence?: number;
  }> {
    if (!this.isEnabled || !this.openai) {
      this.logger.warn('AI command detection requested but not enabled');
      return { isCommand: false };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `${AI_PROMPTS.COMMAND_DETECTOR}\n\nMensaje: "${message}"`
          }
        ],
        max_tokens: 150,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { isCommand: false };
      }

      return JSON.parse(content.trim());
    } catch (error) {
      this.logger.error('Error detecting command:', error);
      return { isCommand: false };
    }
  }

  // Method to get AI service status
  getServiceStatus(): {
    enabled: boolean;
    features: string[];
    limitations: string[];
  } {
    if (this.isEnabled) {
      return {
        enabled: true,
        features: [
          'GPT-4 Vision ticket processing (OCR + AI analysis)',
          'GPT-3.5 expense categorization with confidence scoring',
          'Advanced spending pattern analysis with personalized insights',
          'AI-powered budget suggestions based on historical data',
          'Fallback to mock data when API fails',
          'Comprehensive error handling and logging'
        ],
        limitations: [
          'Requires valid OpenAI API key',
          'Rate limited by OpenAI API quotas',
          'GPT-4 Vision costs more than standard models',
          'Internet connection required for API calls',
          'Category mapping requires manual configuration'
        ]
      };
    }

    return {
      enabled: false,
      features: ['Mock data fallbacks for all AI features', 'Service structure ready for AI integration', 'Comprehensive logging and error handling'],
      limitations: ['No OpenAI API key configured', 'Returns mock/placeholder data only', 'No actual AI processing occurs', 'Limited to predefined responses']
    };
  }

  // Private helper methods for mock data
  private getMockTicketProcessingResult(): TicketProcessingResult {
    return {
      confidence: 0.1,
      extractedText: 'Mock data - OpenAI integration not enabled'
    };
  }

  private getMockCategorySuggestions(description: string): CategorySuggestion[] {
    const mockCategories = [
      { name: 'Food & Dining', confidence: 0.8 },
      { name: 'Shopping', confidence: 0.6 },
      { name: 'Other', confidence: 0.4 }
    ];

    return mockCategories.map((cat, index) => ({
      categoryId: `mock_category_${index}`,
      categoryName: cat.name,
      confidence: cat.confidence,
      reasoning: `Mock categorization for: ${description}`
    }));
  }

  private getMockSpendingAnalysis() {
    return {
      insights: ['Mock insight: AI analysis not enabled', 'Please configure OpenAI API key for real insights', 'Spending patterns would be analyzed with AI'],
      recommendations: ['Set up OpenAI integration for personalized recommendations', 'Configure budget alerts for better expense tracking'],
      trends: []
    };
  }

  private getMockBudgetSuggestions() {
    return {
      suggestedBudgets: [
        {
          categoryId: 'mock_budget_1',
          categoryName: 'Food & Dining',
          suggestedAmount: 500,
          reasoning: 'Mock budget suggestion - OpenAI integration not enabled'
        }
      ]
    };
  }
}
