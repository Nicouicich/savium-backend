import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import OpenAI from 'openai';

export interface TicketProcessingResult {
  amount?: number;
  vendor?: string;
  date?: Date;
  description?: string;
  suggestedCategory?: string;
  confidence?: number;
  extractedText?: string;
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
    const apiKey = this.configService.get<string>('integrations.openai.apiKey');
    this.isEnabled = Boolean(apiKey && apiKey !== 'placeholder-openai-key');

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

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this receipt/ticket image and extract the following information in JSON format:
                {
                  "amount": number (total amount),
                  "vendor": string (store/restaurant name),
                  "date": string (ISO date format),
                  "description": string (brief description of purchase),
                  "suggestedCategory": string (one of: Food & Dining, Transportation, Shopping, Entertainment, Healthcare, Utilities, Travel, Education, Other),
                  "confidence": number (0-1, how confident you are in the extraction),
                  "extractedText": string (all visible text from the image)
                }
                
                If you cannot extract certain information, set those fields to null. Be as accurate as possible.`
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
        max_tokens: 1000,
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

  async categorizeExpense(description: string, amount: number, vendor?: string): Promise<CategorySuggestion[]> {
    if (!this.isEnabled || !this.openai) {
      this.logger.warn('AI categorization requested but not enabled - returning mock data');
      return this.getMockCategorySuggestions(description);
    }

    try {
      const contextInfo = [`Description: ${description}`, `Amount: $${amount}`, vendor ? `Vendor: ${vendor}` : null].filter(Boolean).join('\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a financial categorization assistant. Analyze expense information and suggest the most appropriate categories with confidence scores and reasoning.
            
            Available categories:
            - Food & Dining (restaurants, groceries, food delivery)
            - Transportation (gas, public transport, ride-sharing, car maintenance)
            - Shopping (clothing, electronics, general retail)
            - Entertainment (movies, games, subscriptions, events)
            - Healthcare (medical, dental, pharmacy, insurance)
            - Utilities (electricity, water, internet, phone)
            - Travel (hotels, flights, vacation expenses)
            - Education (courses, books, training)
            - Business (office supplies, professional services)
            - Home & Garden (maintenance, furniture, gardening)
            - Other (miscellaneous expenses)
            
            Return up to 3 suggestions in JSON format as an array of objects with:
            - categoryName: exact category name from the list above
            - confidence: number between 0 and 1
            - reasoning: brief explanation for the suggestion`
          },
          {
            role: 'user',
            content: contextInfo
          }
        ],
        max_tokens: 500,
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
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a financial advisor AI assistant. Analyze spending data and provide helpful insights and recommendations. Be specific and actionable in your advice.'
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
            acc[category] = {total: 0, count: 0};
          }
          acc[category].total += expense.amount;
          acc[category].count += 1;
          return acc;
        },
        {} as Record<string, {total: number; count: number}>
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
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a financial planning assistant. Create realistic monthly budgets based on historical spending patterns. Consider the account type and provide practical, achievable budget recommendations.'
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
      {name: 'Food & Dining', confidence: 0.8},
      {name: 'Shopping', confidence: 0.6},
      {name: 'Other', confidence: 0.4}
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
