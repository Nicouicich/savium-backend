import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Account, AccountDocument } from '../schemas/account.schema';
import { CoupleSettings, CoupleSettingsDocument } from '../schemas/couple-settings.schema';
import { Transaction, TransactionDocument } from '../../transactions/schemas/transaction.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';

import { CoupleFinancialModel, CoupleTransactionType } from '@common/constants/couple-types';
import { AccountType } from '@common/constants/account-types';

export interface CoupleComparativeStats {
  // Overview metrics
  totalSharedTransactions: number;
  totalCoupleSpending: number;
  averageTransactionAmount: number;

  // Partner comparison
  partner1: {
    userId: string;
    name: string;
    personalTransactions: number;
    contributionToShared: number;
    contributionPercentage: number;
    transactionCount: number;
    averageTransactionAmount: number;
    topCategories: CategoryStat[];
  };

  partner2: {
    userId: string;
    name: string;
    personalTransactions: number;
    contributionToShared: number;
    contributionPercentage: number;
    transactionCount: number;
    averageTransactionAmount: number;
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
  transactionCount: number;
  averageAmount: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  partner1Total: number;
  partner2Total: number;
  sharedTotal: number;
  totalTransactions: number;
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
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>
  ) {}

 
}
