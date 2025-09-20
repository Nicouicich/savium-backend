export enum CoupleFinancialModel {
  FIFTY_FIFTY = 'fifty_fifty',
  PROPORTIONAL_INCOME = 'proportional_income',
  EVERYTHING_COMMON = 'everything_common',
  MIXED = 'mixed'
}

export enum CoupleTransactionType {
  SHARED = 'shared',
  PERSONAL = 'personal'
}

export enum CoupleNotificationType {
  EXPENSE_ADDED = 'transaction_added',
  COMMENT_ADDED = 'comment_added',
  GIFT_REVEALED = 'gift_revealed',
  GOAL_ACHIEVED = 'goal_achieved',
  REMINDER_DUE = 'reminder_due',
  BUDGET_ALERT = 'budget_alert'
}

export enum CoupleReactionType {
  LIKE = 'like',
  LOVE = 'love',
  CONCERN = 'concern',
  QUESTION = 'question',
  SURPRISE = 'surprise'
}

export interface CoupleFinancialModelConfig {
  name: string;
  description: string;
  features: string[];
  requiredSettings: string[];
}

export const COUPLE_FINANCIAL_MODELS: Record<CoupleFinancialModel, CoupleFinancialModelConfig> = {
  [CoupleFinancialModel.FIFTY_FIFTY]: {
    name: '50/50 Automatic',
    description: 'All shared transactions are automatically divided in half between both partners',
    features: [
      'automatic_transaction_splitting',
      'equal_contribution_tracking',
      'settlement_suggestions'
    ],
    requiredSettings: []
  },

  [CoupleFinancialModel.PROPORTIONAL_INCOME]: {
    name: 'Proportional to Income',
    description: 'Transactions are split based on the configured income percentage of each partner',
    features: [
      'income_based_splitting',
      'contribution_percentage_tracking',
      'fair_share_analytics'
    ],
    requiredSettings: ['partner1_contribution_percentage', 'partner2_contribution_percentage']
  },

  [CoupleFinancialModel.EVERYTHING_COMMON]: {
    name: 'Everything in Common',
    description: 'No transaction divisions calculated; everything is seen as shared finances',
    features: [
      'unified_balance_view',
      'combined_analytics',
      'joint_budgeting'
    ],
    requiredSettings: []
  },

  [CoupleFinancialModel.MIXED]: {
    name: 'Mixed Model',
    description: 'Allows both shared and personal transactions within the couple account',
    features: [
      'transaction_type_selection',
      'partial_sharing',
      'flexible_splitting',
      'personal_transaction_tracking'
    ],
    requiredSettings: ['default_transaction_type']
  }
};

export interface CoupleContributionSettings {
  partner1UserId: string;
  partner2UserId: string;
  partner1ContributionPercentage: number;
  partner2ContributionPercentage: number;
  partner1MonthlyIncome?: number;
  partner2MonthlyIncome?: number;
  autoCalculateFromIncome: boolean;
  lastUpdatedAt: Date;
  updatedBy: string;
}

export interface CouplePreferences {
  financialModel: CoupleFinancialModel;
  defaultTransactionType: CoupleTransactionType;
  contributionSettings?: CoupleContributionSettings;
  allowComments: boolean;
  allowReactions: boolean;
  showContributionStats: boolean;
  enableCrossReminders: boolean;
  giftModeEnabled: boolean;
  sharedGoalsEnabled: boolean;
  notifications: {
    transactionAdded: boolean;
    commentsAndReactions: boolean;
    giftRevealed: boolean;
    reminders: boolean;
    budgetAlerts: boolean;
  };
}

export const DEFAULT_COUPLE_PREFERENCES: CouplePreferences = {
  financialModel: CoupleFinancialModel.FIFTY_FIFTY,
  defaultTransactionType: CoupleTransactionType.SHARED,
  allowComments: true,
  allowReactions: true,
  showContributionStats: true,
  enableCrossReminders: true,
  giftModeEnabled: true,
  sharedGoalsEnabled: true,
  notifications: {
    transactionAdded: true,
    commentsAndReactions: true,
    giftRevealed: true,
    reminders: true,
    budgetAlerts: true
  }
};

export interface CoupePremiumFeatures {
  sharedGoals: boolean;
  detailedComparisons: boolean;
  jointEvolutionPanel: boolean;
  downloadableReports: boolean;
  advancedAnalytics: boolean;
  unlimitedComments: boolean;
  customCategories: boolean;
}

export const COUPLE_PREMIUM_FEATURES: Record<string, CoupePremiumFeatures> = {
  'basic': {
    sharedGoals: false,
    detailedComparisons: false,
    jointEvolutionPanel: false,
    downloadableReports: false,
    advancedAnalytics: false,
    unlimitedComments: false,
    customCategories: false
  },
  'one_premium': {
    sharedGoals: false,
    detailedComparisons: false,
    jointEvolutionPanel: false,
    downloadableReports: false,
    advancedAnalytics: false,
    unlimitedComments: true,
    customCategories: true
  },
  'both_premium': {
    sharedGoals: true,
    detailedComparisons: true,
    jointEvolutionPanel: true,
    downloadableReports: true,
    advancedAnalytics: true,
    unlimitedComments: true,
    customCategories: true
  }
};

export interface TransactionContextMap {
  personal: 'personal';
  pareja: 'couple';
  familia: 'family';
  negocio: 'business';
}

export const EXPENSE_CONTEXT_MAPPING: TransactionContextMap = {
  personal: 'personal',
  pareja: 'couple',
  familia: 'family',
  negocio: 'business'
};

export const CONTEXT_KEYWORDS = {
  PERSONAL: ['@personal', '@yo', '@mio'],
  COUPLE: ['@pareja', '@couple', '@nosotros', '@nuestro'],
  FAMILY: ['@familia', '@family', '@fam'],
  BUSINESS: ['@negocio', '@business', '@trabajo', '@empresa']
};