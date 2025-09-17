import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Account, AccountDocument } from '../../accounts/schemas/account.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { CONTEXT_KEYWORDS, EXPENSE_CONTEXT_MAPPING, CoupleExpenseType } from '@common/constants/couple-types';
import { AccountType } from '@common/constants/account-types';

export interface ParsedExpenseContext {
  context: 'personal' | 'couple' | 'family' | 'business' | null;
  cleanDescription: string;
  originalContext?: string;
  confidence: number;
  suggestedAccountId?: string;
  expenseType?: CoupleExpenseType;
  accountType?: AccountType;
}

@Injectable()
export class ExpenseContextParserService {
  constructor(
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>
  ) {}

  /**
   * Parse expense description for context keywords (@pareja, @personal, etc.)
   */
  async parseExpenseContext(description: string, userId: string): Promise<ParsedExpenseContext> {
    const result: ParsedExpenseContext = {
      context: null,
      cleanDescription: description.trim(),
      confidence: 0.0
    };

    // Extract context keywords from description
    const contextMatch = this.extractContextFromDescription(description);

    if (!contextMatch) {
      return result;
    }

    result.originalContext = contextMatch.keyword;
    result.cleanDescription = contextMatch.cleanDescription;
    result.context = contextMatch.context;
    result.confidence = contextMatch.confidence;

    // Find appropriate account based on context
    const suggestedAccount = await this.findAccountByContext(result.context, userId);

    if (suggestedAccount) {
      result.suggestedAccountId = (suggestedAccount as any).id;
      result.accountType = suggestedAccount.type;

      // For couple accounts, determine default expense type
      if (suggestedAccount.type === AccountType.COUPLE) {
        result.expenseType = await this.getCoupleDefaultExpenseType((suggestedAccount as any).id);
      }
    }

    return result;
  }

  /**
   * Extract context keyword from expense description
   */
  private extractContextFromDescription(description: string): {
    keyword: string;
    context: 'personal' | 'couple' | 'family' | 'business';
    cleanDescription: string;
    confidence: number;
  } | null {
    const lowerDescription = description.toLowerCase();

    // Check for context keywords
    for (const [contextType, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();

        // Exact match with word boundaries
        const exactRegex = new RegExp(`\\s*${keywordLower.replace('@', '\\@')}\\s*`, 'gi');
        const match = lowerDescription.match(exactRegex);

        if (match) {
          const cleanDescription = description.replace(exactRegex, ' ').trim();
          const contextMap: Record<string, 'personal' | 'couple' | 'family' | 'business'> = {
            PERSONAL: 'personal',
            COUPLE: 'couple',
            FAMILY: 'family',
            BUSINESS: 'business'
          };

          return {
            keyword: match[0].trim(),
            context: contextMap[contextType],
            cleanDescription,
            confidence: this.calculateContextConfidence(keyword, description)
          };
        }
      }
    }

    return null;
  }

  /**
   * Calculate confidence score for context parsing
   */
  private calculateContextConfidence(keyword: string, description: string): number {
    let confidence = 0.8; // Base confidence for exact keyword match

    // Higher confidence for @ symbol usage
    if (keyword.startsWith('@')) {
      confidence += 0.15;
    }

    // Lower confidence if keyword appears multiple times (might be noise)
    const keywordCount = (description.toLowerCase().match(new RegExp(keyword.toLowerCase().replace('@', '\\@'), 'g')) || []).length;

    if (keywordCount > 1) {
      confidence -= 0.1 * (keywordCount - 1);
    }

    // Ensure confidence stays within bounds
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Find user's account that matches the parsed context
   */
  private async findAccountByContext(context: 'personal' | 'couple' | 'family' | 'business', userId: string): Promise<AccountDocument | null> {
    const accountTypeMap: Record<string, AccountType> = {
      personal: AccountType.PERSONAL,
      couple: AccountType.COUPLE,
      family: AccountType.FAMILY,
      business: AccountType.BUSINESS
    };

    const accountType = accountTypeMap[context];
    if (!accountType) return null;

    // Find user's accounts of the specified type
    const accounts = await this.accountModel
      .find({
        $and: [
          { type: accountType },
          { isDeleted: false },
          { status: 'active' },
          {
            $or: [{ owner: userId }, { 'members.userId': userId, 'members.isActive': true }]
          }
        ]
      })
      .sort({ lastActivityAt: -1 })
      .limit(1);

    return accounts[0] || null;
  }

  /**
   * Get default expense type for couple account
   */
  private async getCoupleDefaultExpenseType(accountId: string): Promise<CoupleExpenseType> {
    const account = await this.accountModel.findById(accountId).populate('coupleSettingsId');

    if (account?.coupleSettingsId) {
      const coupleSettings = account.coupleSettingsId as any;
      return coupleSettings.defaultExpenseType || CoupleExpenseType.SHARED;
    }

    return CoupleExpenseType.SHARED; // Default fallback
  }

  /**
   * Batch parse multiple expense descriptions
   */
  async batchParseExpenseContexts(
    descriptions: { description: string; id?: string }[],
    userId: string
  ): Promise<Array<ParsedExpenseContext & { id?: string }>> {
    const results = await Promise.all(
      descriptions.map(async ({ description, id }) => ({
        ...(await this.parseExpenseContext(description, userId)),
        id
      }))
    );

    return results;
  }

  /**
   * Suggest context based on expense content and user history
   */
  async suggestContext(
    description: string,
    amount: number,
    userId: string,
    category?: string
  ): Promise<
    {
      suggestedContext: 'personal' | 'couple' | 'family' | 'business';
      confidence: number;
      reason: string;
    }[]
  > {
    const suggestions: Array<{
      suggestedContext: 'personal' | 'couple' | 'family' | 'business';
      confidence: number;
      reason: string;
    }> = [];

    // Get user's accounts
    const userAccounts = await this.accountModel.find({
      $or: [{ owner: userId }, { 'members.userId': userId, 'members.isActive': true }],
      isDeleted: false,
      status: 'active'
    });

    // Analyze description for context clues
    const descLower = description.toLowerCase();

    // Business-related keywords
    const businessKeywords = ['office', 'meeting', 'client', 'business', 'conference', 'work', 'professional'];
    const hasBusinessKeywords = businessKeywords.some(keyword => descLower.includes(keyword));

    if (hasBusinessKeywords && userAccounts.some(acc => acc.type === AccountType.BUSINESS)) {
      suggestions.push({
        suggestedContext: 'business',
        confidence: 0.7,
        reason: 'Business-related keywords detected'
      });
    }

    // Family-related keywords
    const familyKeywords = ['kids', 'children', 'family', 'school', 'childcare', 'family trip'];
    const hasFamilyKeywords = familyKeywords.some(keyword => descLower.includes(keyword));

    if (hasFamilyKeywords && userAccounts.some(acc => acc.type === AccountType.FAMILY)) {
      suggestions.push({
        suggestedContext: 'family',
        confidence: 0.8,
        reason: 'Family-related keywords detected'
      });
    }

    // Couple-related keywords (shared expenses)
    const coupleKeywords = ['dinner', 'groceries', 'rent', 'utilities', 'vacation', 'movie', 'date'];
    const hasCoupleKeywords = coupleKeywords.some(keyword => descLower.includes(keyword));

    if (hasCoupleKeywords && userAccounts.some(acc => acc.type === AccountType.COUPLE)) {
      suggestions.push({
        suggestedContext: 'couple',
        confidence: 0.6,
        reason: 'Typical shared expense category'
      });
    }

    // High amounts might suggest shared expenses
    if (amount > 100 && userAccounts.some(acc => acc.type === AccountType.COUPLE)) {
      suggestions.push({
        suggestedContext: 'couple',
        confidence: 0.5,
        reason: 'High amount suggests shared expense'
      });
    }

    // Default to personal if no clear context
    if (suggestions.length === 0) {
      suggestions.push({
        suggestedContext: 'personal',
        confidence: 0.3,
        reason: 'No specific context detected, defaulting to personal'
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Validate and clean parsed context data
   */
  validateParsedContext(parsedContext: ParsedExpenseContext, userId: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate confidence score
    if (parsedContext.confidence < 0 || parsedContext.confidence > 1) {
      errors.push('Confidence score must be between 0 and 1');
    }

    // Validate context value
    const validContexts = ['personal', 'couple', 'family', 'business'];
    if (parsedContext.context && !validContexts.includes(parsedContext.context)) {
      errors.push('Invalid context value');
    }

    // Validate expense type for couple context
    if (parsedContext.context === 'couple' && parsedContext.expenseType) {
      const validExpenseTypes = Object.values(CoupleExpenseType);
      if (!validExpenseTypes.includes(parsedContext.expenseType)) {
        errors.push('Invalid expense type for couple context');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
