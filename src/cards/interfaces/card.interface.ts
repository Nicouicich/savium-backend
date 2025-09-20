import { CardBrand, CardStatus, CardType } from '@common/constants/card-types';
import { Types } from 'mongoose';

export interface ICard {
  _id?: Types.ObjectId;
  userId: string;
  profileId: Types.ObjectId;
  displayName: string;
  lastFourDigits?: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  cardBrand?: CardBrand;
  cardType: CardType;
  issuerBank?: string;
  color?: string;
  icon?: string;
  creditLimit?: number;
  billingCycleDay?: number;
  interestRate?: number;
  annualFee?: number;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  status: CardStatus;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMaskedCard {
  _id: Types.ObjectId;
  userId: string;
  profileId: Types.ObjectId;
  displayName: string;
  lastFourDigits?: string; // Decrypted but still masked (e.g., "****1234")
  cardBrand?: CardBrand;
  cardType: CardType;
  issuerBank?: string;
  color?: string;
  icon?: string;
  creditLimit?: number;
  billingCycleDay?: number;
  interestRate?: number;
  annualFee?: number;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  status: CardStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICardBalance {
  _id?: Types.ObjectId;
  cardId: Types.ObjectId;
  userId: string;
  currentBalance: number;
  availableCredit?: number;
  minimumPayment?: number;
  paymentDueDate?: Date;
  currency: string;
  statementStartDate?: Date;
  statementEndDate?: Date;
  statementBalance?: number;
  lastUpdated: Date;
  isAutomaticUpdate: boolean;
  updateSource: string;
  utilizationRate?: number;
  isOverdue: boolean;
  overdueAmount?: number;
  lateFees?: number;
  interestCharges?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPaymentMethod {
  _id?: Types.ObjectId;
  name: string;
  code: string;
  type: string;
  requiresCard: boolean;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICardStatistics {
  cardId: Types.ObjectId;
  period: {
    start: Date;
    end: Date;
  };
  totalSpent: number;
  totalTransactions: number;
  averageTransaction: number;
  currentBalance: number;
  availableCredit?: number;
  utilizationRate?: number;
  categoryBreakdown: ICategorySpending[];
  monthlySpending: IMonthlySpending[];
  topMerchants: IMerchantSpending[];
  paymentDue?: Date;
  minimumPayment?: number;
}

export interface ICategorySpending {
  categoryId: Types.ObjectId;
  categoryName: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface IMonthlySpending {
  month: string;
  year: number;
  amount: number;
  transactionCount: number;
}

export interface IMerchantSpending {
  merchant: string;
  amount: number;
  transactionCount: number;
  lastTransaction: Date;
}

export interface IPaymentDueSummary {
  cardId: Types.ObjectId;
  displayName: string;
  dueDate: Date;
  minimumPayment: number;
  currentBalance: number;
  isOverdue: boolean;
  daysUntilDue: number;
}

export interface IDebtSummary {
  totalDebt: number;
  totalMinimumPayment: number;
  totalAvailableCredit: number;
  averageUtilizationRate: number;
  cardsCount: number;
  overdueCount: number;
  totalOverdueAmount: number;
}

export interface IUtilizationMetrics {
  cardId: Types.ObjectId;
  currentBalance: number;
  creditLimit: number;
  utilizationRate: number;
  availableCredit: number;
  isOptimal: boolean; // Under 30% utilization
  recommendation?: string;
}
