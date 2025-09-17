import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Account, AccountDocument } from '../schemas/account.schema';
import { CoupleSettings, CoupleSettingsDocument } from '../schemas/couple-settings.schema';
import { Expense, ExpenseDocument } from '../../expenses/schemas/expense.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';

import { CoupleFinancialModel, CoupleExpenseType } from '@common/constants/couple-types';
import { AccountType } from '@common/constants/account-types';

export interface CoupleComparativeStats {
  // Overview metrics
  totalSharedExpenses: number;
  totalCoupleSpending: number;
  averageExpenseAmount: number;

  // Partner comparison
  partner1: {
    userId: string;
    name: string;
    personalExpenses: number;
    contributionToShared: number;
    contributionPercentage: number;
    expenseCount: number;
    averageExpenseAmount: number;
    topCategories: CategoryStat[];
  };

  partner2: {
    userId: string;
    name: string;
    personalExpenses: number;
    contributionToShared: number;
    contributionPercentage: number;
    expenseCount: number;
    averageExpenseAmount: number;
    topCategories: CategoryStat[];
  };

  // Balance and settlement
  settlementStatus: {
    outstandingBalance: number;
    owingPartner: string | null;
    lastSettlement?: Date;
    totalSettlements: number;
  };

  // Trends and insights
  monthlyTrends: MonthlyTrend[];
  categoryComparison: CategoryComparison[];
  spendingPatterns: SpendingPattern[];

  // Premium insights (if enabled)
  detailedAnalytics?: {
    savingsOpportunities: SavingsOpportunity[];
    budgetRecommendations: BudgetRecommendation[];
    behavioralInsights: BehavioralInsight[];
    futureProjections: FutureProjection[];
  };
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  expenseCount: number;
  averageAmount: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  partner1Total: number;
  partner2Total: number;
  sharedTotal: number;
  totalExpenses: number;
  partner1Percentage: number;
  partner2Percentage: number;
}

export interface CategoryComparison {
  categoryId: string;
  categoryName: string;
  partner1Amount: number;
  partner2Amount: number;
  partner1Count: number;
  partner2Count: number;
  difference: number;
  percentageDifference: number;
}

export interface SpendingPattern {
  pattern: 'increasing' | 'decreasing' | 'stable' | 'seasonal';
  description: string;
  confidence: number;
  affectedCategories: string[];
  recommendation?: string;
}

export interface SavingsOpportunity {
  category: string;
  potentialSavings: number;
  description: string;
  actionItems: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface BudgetRecommendation {
  category: string;
  currentSpending: number;
  recommendedBudget: number;
  reason: string;
  timeframe: 'monthly' | 'weekly';
}

export interface BehavioralInsight {
  insight: string;
  impact: 'positive' | 'negative' | 'neutral';
  affectedPartner?: string;
  suggestion?: string;
}

export interface FutureProjection {
  month: string;
  projectedTotal: number;
  projectedShared: number;
  projectedPersonal: number;
  confidence: number;
}

@Injectable()
export class CoupleAnalyticsService {
  constructor(
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
    @InjectModel(CoupleSettings.name)
    private readonly coupleSettingsModel: Model<CoupleSettingsDocument>,
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>
  ) {}

  /**
   * Generate comprehensive comparative statistics for a couple
   */
  async generateComparativeStats(
    accountId: string,
    userId: string,
    dateRange?: { startDate: Date; endDate: Date },
    includeDetailedAnalytics: boolean = false
  ): Promise<CoupleComparativeStats> {
    const account = await this.accountModel.findById(accountId).populate('coupleSettingsId');
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    this.verifyUserAccess(account, userId);

    // We need to populate coupleSettingsId or fetch it separately
    if (!account.coupleSettingsId) {
      throw new NotFoundException('Couple settings not found');
    }

    const coupleSettings = await this.coupleSettingsModel.findOne({ accountId: account._id });
    if (!coupleSettings) {
      throw new NotFoundException('Couple settings not found');
    }

    const partners = this.getAccountPartners(account);
    if (partners.length !== 2) {
      throw new Error('Couple account must have exactly 2 partners');
    }

    // Get partner details
    const partner1 = await this.userModel.findById(partners[0]);
    const partner2 = await this.userModel.findById(partners[1]);

    // Set default date range (last 12 months)
    const endDate = dateRange?.endDate || new Date();
    const startDate = dateRange?.startDate || new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get all expenses in the date range
    const expenses = await this.expenseModel
      .find({
        accountId: new Types.ObjectId(accountId),
        date: { $gte: startDate, $lte: endDate },
        isDeleted: false
      })
      .populate('categoryId', 'name');

    // Calculate basic statistics
    const basicStats = this.calculateBasicStats(expenses);

    // Calculate partner-specific stats
    const partner1Stats = this.calculatePartnerStats(expenses, partners[0]);
    const partner2Stats = this.calculatePartnerStats(expenses, partners[1]);

    // Calculate settlement status
    const settlementStatus = this.calculateSettlementStatus(expenses);

    // Calculate trends
    const monthlyTrends = this.calculateMonthlyTrends(expenses, partners);

    // Calculate category comparisons
    const categoryComparison = this.calculateCategoryComparison(expenses, partners);

    // Analyze spending patterns
    const spendingPatterns = this.analyzeSpendingPatterns(expenses, monthlyTrends);

    const result: CoupleComparativeStats = {
      ...basicStats,
      partner1: {
        ...partner1Stats,
        userId: partners[0],
        name: `${partner1?.firstName || 'Partner'} ${partner1?.lastName || '1'}`
      },
      partner2: {
        ...partner2Stats,
        userId: partners[1],
        name: `${partner2?.firstName || 'Partner'} ${partner2?.lastName || '2'}`
      },
      settlementStatus,
      monthlyTrends,
      categoryComparison,
      spendingPatterns
    };

    // Add detailed analytics if requested and available (premium feature)
    if (includeDetailedAnalytics && coupleSettings.hasAdvancedAnalytics) {
      result.detailedAnalytics = this.generateDetailedAnalytics();
    }

    return result;
  }

  /**
   * Generate spending comparison report between partners
   */
  async generateSpendingComparison(
    accountId: string,
    userId: string,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<{
    period: string;
    startDate: Date;
    endDate: Date;
    comparison: {
      categories: CategoryComparison[];
      totalComparison: {
        partner1Total: number;
        partner2Total: number;
        difference: number;
        percentageDifference: number;
      };
      insights: string[];
    };
  }> {
    const account = await this.accountModel.findById(accountId);
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    this.verifyUserAccess(account, userId);

    // Calculate date range based on period
    const { startDate, endDate } = this.getDateRangeForPeriod(period);

    const partners = this.getAccountPartners(account);
    const expenses = await this.expenseModel
      .find({
        accountId: new Types.ObjectId(accountId),
        date: { $gte: startDate, $lte: endDate },
        isDeleted: false
      })
      .populate('categoryId', 'name');

    const categoryComparison = this.calculateCategoryComparison(expenses, partners);

    const partner1Total = expenses.filter(e => e.userId.toString() === partners[0]).reduce((sum, e) => sum + e.amount, 0);

    const partner2Total = expenses.filter(e => e.userId.toString() === partners[1]).reduce((sum, e) => sum + e.amount, 0);

    const difference = Math.abs(partner1Total - partner2Total);
    const percentageDifference = partner1Total + partner2Total > 0 ? (difference / (partner1Total + partner2Total)) * 100 : 0;

    const insights = this.generateSpendingInsights(categoryComparison, {
      partner1Total,
      partner2Total,
      difference,
      percentageDifference
    });

    return {
      period,
      startDate,
      endDate,
      comparison: {
        categories: categoryComparison,
        totalComparison: {
          partner1Total,
          partner2Total,
          difference,
          percentageDifference
        },
        insights
      }
    };
  }

  /**
   * Get contribution balance between partners
   */
  async getContributionBalance(
    accountId: string,
    userId: string,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<{
    currentBalance: number;
    whoOwes: 'partner1' | 'partner2' | 'balanced';
    recommendedTransfer?: number;
    breakdown: {
      sharedExpenses: number;
      partner1Contribution: number;
      partner2Contribution: number;
      partner1Expected: number;
      partner2Expected: number;
    };
    history: Array<{
      date: Date;
      balance: number;
      description: string;
    }>;
  }> {
    const account = await this.accountModel.findById(accountId).populate('coupleSettingsId');
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    this.verifyUserAccess(account, userId);

    // We need to populate coupleSettingsId or fetch it separately
    if (!account.coupleSettingsId) {
      throw new NotFoundException('Couple settings not found');
    }

    const coupleSettings = await this.coupleSettingsModel.findOne({ accountId: account._id });
    if (!coupleSettings) {
      throw new NotFoundException('Couple settings not found');
    }

    const partners = this.getAccountPartners(account);

    const endDate = dateRange?.endDate || new Date();
    const startDate = dateRange?.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get shared expenses
    const sharedExpenses = await this.expenseModel.find({
      accountId: new Types.ObjectId(accountId),
      date: { $gte: startDate, $lte: endDate },
      'coupleData.expenseType': CoupleExpenseType.SHARED,
      isDeleted: false
    });

    const totalSharedAmount = sharedExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate expected contributions based on financial model
    let partner1Expected = 0;
    let partner2Expected = 0;

    switch (coupleSettings.financialModel) {
      case CoupleFinancialModel.FIFTY_FIFTY:
        partner1Expected = partner2Expected = totalSharedAmount / 2;
        break;

      case CoupleFinancialModel.PROPORTIONAL_INCOME:
        if (coupleSettings.contributionSettings) {
          const p1Percentage = coupleSettings.contributionSettings.partner1ContributionPercentage / 100;
          partner1Expected = totalSharedAmount * p1Percentage;
          partner2Expected = totalSharedAmount * (1 - p1Percentage);
        }
        break;

      case CoupleFinancialModel.EVERYTHING_COMMON:
        // In this model, everything is shared equally
        partner1Expected = partner2Expected = totalSharedAmount / 2;
        break;
    }

    // Calculate actual contributions (who paid for what)
    const partner1Actual = sharedExpenses.filter(exp => exp.userId.toString() === partners[0]).reduce((sum, exp) => sum + exp.amount, 0);

    const partner2Actual = sharedExpenses.filter(exp => exp.userId.toString() === partners[1]).reduce((sum, exp) => sum + exp.amount, 0);

    const currentBalance = partner1Actual - partner1Expected - (partner2Actual - partner2Expected);

    let whoOwes: 'partner1' | 'partner2' | 'balanced' = 'balanced';
    if (Math.abs(currentBalance) > 5) {
      // $5 threshold for "balanced"
      whoOwes = currentBalance > 0 ? 'partner2' : 'partner1';
    }

    const recommendedTransfer = Math.abs(currentBalance) > 5 ? Math.abs(currentBalance) : undefined;

    // Generate balance history (simplified)
    const history = this.generateBalanceHistory();

    return {
      currentBalance,
      whoOwes,
      recommendedTransfer,
      breakdown: {
        sharedExpenses: totalSharedAmount,
        partner1Contribution: partner1Actual,
        partner2Contribution: partner2Actual,
        partner1Expected,
        partner2Expected
      },
      history
    };
  }

  // Private helper methods
  private verifyUserAccess(account: AccountDocument, userId: string): void {
    const hasAccess = account.owner.toString() === userId || account.members.some(member => member.userId.toString() === userId && member.isActive);

    if (!hasAccess) {
      throw new ForbiddenException('User does not have access to this couple account');
    }
  }

  private getAccountPartners(account: AccountDocument): string[] {
    const partners = [account.owner.toString()];

    account.members.forEach(member => {
      if (member.isActive && !partners.includes(member.userId.toString())) {
        partners.push(member.userId.toString());
      }
    });

    return partners;
  }

  private calculateBasicStats(expenses: ExpenseDocument[]) {
    const sharedExpenses = expenses.filter(
      exp => exp.coupleData?.expenseType === CoupleExpenseType.SHARED || (exp.isSharedExpense && !exp.coupleData?.expenseType)
    );

    const totalSharedExpenses = sharedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalCoupleSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const averageExpenseAmount = expenses.length > 0 ? totalCoupleSpending / expenses.length : 0;

    return {
      totalSharedExpenses,
      totalCoupleSpending,
      averageExpenseAmount
    };
  }

  private calculatePartnerStats(expenses: ExpenseDocument[], partnerId: string) {
    const partnerExpenses = expenses.filter(exp => exp.userId.toString() === partnerId);
    const personalExpenses = partnerExpenses
      .filter(exp => !exp.isSharedExpense || exp.coupleData?.expenseType === CoupleExpenseType.PERSONAL)
      .reduce((sum, exp) => sum + exp.amount, 0);

    const contributionToShared = partnerExpenses
      .filter(exp => exp.isSharedExpense || exp.coupleData?.expenseType === CoupleExpenseType.SHARED)
      .reduce((sum, exp) => sum + exp.amount, 0);

    const totalContributions = personalExpenses + contributionToShared;
    const contributionPercentage = totalContributions > 0 ? (contributionToShared / totalContributions) * 100 : 0;

    const topCategories = this.calculateTopCategories(partnerExpenses);
    const averageExpenseAmount = partnerExpenses.length > 0 ? partnerExpenses.reduce((sum, exp) => sum + exp.amount, 0) / partnerExpenses.length : 0;

    return {
      personalExpenses,
      contributionToShared,
      contributionPercentage,
      expenseCount: partnerExpenses.length,
      averageExpenseAmount,
      topCategories
    };
  }

  private calculateTopCategories(expenses: ExpenseDocument[]): CategoryStat[] {
    const categoryMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        totalAmount: number;
        expenseCount: number;
      }
    >();

    expenses.forEach(expense => {
      const categoryId = expense.categoryId.toString();
      const categoryName = (expense.categoryId as any)?.name || 'Unknown';

      if (categoryMap.has(categoryId)) {
        const existing = categoryMap.get(categoryId)!;
        existing.totalAmount += expense.amount;
        existing.expenseCount += 1;
      } else {
        categoryMap.set(categoryId, {
          categoryId,
          categoryName,
          totalAmount: expense.amount,
          expenseCount: 1
        });
      }
    });

    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return Array.from(categoryMap.values())
      .map(cat => ({
        ...cat,
        averageAmount: cat.totalAmount / cat.expenseCount,
        percentage: totalAmount > 0 ? (cat.totalAmount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10); // Top 10 categories
  }

  private calculateSettlementStatus(expenses: ExpenseDocument[]) {
    // This is a simplified implementation
    // In a real system, you'd track actual settlements and payments

    const settledExpenses = expenses.filter(exp => exp.coupleData?.isSettled);
    const lastSettlement = settledExpenses.length > 0 ? settledExpenses[settledExpenses.length - 1].coupleData?.settledAt : undefined;

    return {
      outstandingBalance: 0, // Calculate based on actual logic
      owingPartner: null,
      lastSettlement,
      totalSettlements: settledExpenses.length
    };
  }

  private calculateMonthlyTrends(expenses: ExpenseDocument[], partners: string[]): MonthlyTrend[] {
    const monthMap = new Map<
      string,
      {
        month: string;
        year: number;
        partner1Total: number;
        partner2Total: number;
        sharedTotal: number;
      }
    >();

    expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: date.toLocaleDateString('en-US', { month: 'long' }),
          year: date.getFullYear(),
          partner1Total: 0,
          partner2Total: 0,
          sharedTotal: 0
        });
      }

      const monthData = monthMap.get(monthKey)!;

      if (expense.userId.toString() === partners[0]) {
        monthData.partner1Total += expense.amount;
      } else if (expense.userId.toString() === partners[1]) {
        monthData.partner2Total += expense.amount;
      }

      if (expense.isSharedExpense || expense.coupleData?.expenseType === CoupleExpenseType.SHARED) {
        monthData.sharedTotal += expense.amount;
      }
    });

    return Array.from(monthMap.values())
      .map(data => {
        const totalExpenses = data.partner1Total + data.partner2Total;
        return {
          ...data,
          totalExpenses,
          partner1Percentage: totalExpenses > 0 ? (data.partner1Total / totalExpenses) * 100 : 0,
          partner2Percentage: totalExpenses > 0 ? (data.partner2Total / totalExpenses) * 100 : 0
        };
      })
      .sort((a, b) => a.year - b.year || a.month.localeCompare(b.month));
  }

  private calculateCategoryComparison(expenses: ExpenseDocument[], partners: string[]): CategoryComparison[] {
    const categoryMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        partner1Amount: number;
        partner2Amount: number;
        partner1Count: number;
        partner2Count: number;
      }
    >();

    expenses.forEach(expense => {
      const categoryId = expense.categoryId.toString();
      const categoryName = (expense.categoryId as any)?.name || 'Unknown';

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          categoryId,
          categoryName,
          partner1Amount: 0,
          partner2Amount: 0,
          partner1Count: 0,
          partner2Count: 0
        });
      }

      const categoryData = categoryMap.get(categoryId)!;

      if (expense.userId.toString() === partners[0]) {
        categoryData.partner1Amount += expense.amount;
        categoryData.partner1Count += 1;
      } else if (expense.userId.toString() === partners[1]) {
        categoryData.partner2Amount += expense.amount;
        categoryData.partner2Count += 1;
      }
    });

    return Array.from(categoryMap.values())
      .map(cat => {
        const difference = cat.partner1Amount - cat.partner2Amount;
        const totalAmount = cat.partner1Amount + cat.partner2Amount;
        const percentageDifference = totalAmount > 0 ? (Math.abs(difference) / totalAmount) * 100 : 0;

        return {
          ...cat,
          difference,
          percentageDifference
        };
      })
      .sort((a, b) => b.partner1Amount + b.partner2Amount - (a.partner1Amount + a.partner2Amount));
  }

  private analyzeSpendingPatterns(expenses: ExpenseDocument[], monthlyTrends: MonthlyTrend[]): SpendingPattern[] {
    const patterns: SpendingPattern[] = [];

    // Analyze trends
    if (monthlyTrends.length >= 3) {
      const recent = monthlyTrends.slice(-3);
      const trend = this.detectTrend(recent.map(t => t.totalExpenses));

      if (trend.pattern !== 'stable') {
        patterns.push({
          pattern: trend.pattern,
          description: `Spending has been ${trend.pattern} over the last 3 months`,
          confidence: trend.confidence,
          affectedCategories: [],
          recommendation:
            trend.pattern === 'increasing'
              ? 'Consider reviewing your budget and identifying areas to reduce spending'
              : 'Great job on reducing expenses! Consider if this trend is sustainable'
        });
      }
    }

    return patterns;
  }

  private detectTrend(values: number[]): {
    pattern: 'increasing' | 'decreasing' | 'stable';
    confidence: number;
  } {
    if (values.length < 2) return { pattern: 'stable', confidence: 0 };

    let increasing = 0;
    let decreasing = 0;

    for (let i = 1; i < values.length; i++) {
      const change = (values[i] - values[i - 1]) / values[i - 1];
      if (change > 0.05) increasing++;
      else if (change < -0.05) decreasing++;
    }

    if (increasing > decreasing) {
      return { pattern: 'increasing', confidence: increasing / (values.length - 1) };
    } else if (decreasing > increasing) {
      return { pattern: 'decreasing', confidence: decreasing / (values.length - 1) };
    } else {
      return { pattern: 'stable', confidence: 0.8 };
    }
  }

  private generateDetailedAnalytics() {
    // This would be a more comprehensive implementation with ML insights
    // For now, return mock data structure
    return {
      savingsOpportunities: [],
      budgetRecommendations: [],
      behavioralInsights: [],
      futureProjections: []
    };
  }

  private getDateRangeForPeriod(period: 'week' | 'month' | 'quarter' | 'year'): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  }

  private generateSpendingInsights(categoryComparison: CategoryComparison[], totalComparison: any): string[] {
    const insights: string[] = [];

    if (totalComparison.percentageDifference > 20) {
      insights.push(`There's a ${totalComparison.percentageDifference.toFixed(1)}% difference in total spending between partners`);
    }

    const significantDifferences = categoryComparison.filter(cat => cat.percentageDifference > 30 && cat.partner1Amount + cat.partner2Amount > 100).slice(0, 3);

    significantDifferences.forEach(cat => {
      const higherSpender = cat.partner1Amount > cat.partner2Amount ? 'Partner 1' : 'Partner 2';
      insights.push(`${higherSpender} spends significantly more on ${cat.categoryName}`);
    });

    return insights;
  }

  private generateBalanceHistory() {
    // This would calculate historical balance changes
    // For now, return empty array
    return [];
  }
}
