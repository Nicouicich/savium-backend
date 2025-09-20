import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Currency } from '@common/constants/transaction-categories';

export type BudgetDocument = Budget & Document;

export enum BudgetPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

export enum BudgetStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  EXCEEDED = 'exceeded',
  COMPLETED = 'completed'
}

export enum AlertType {
  PERCENTAGE = 'percentage', // Alert when X% of budget is spent
  AMOUNT = 'amount', // Alert when specific amount is reached
  REMAINING = 'remaining' // Alert when X amount remaining
}

@Schema()
export class BudgetAlert {
  @Prop({ enum: AlertType, required: true })
  type: AlertType;

  @Prop({ required: true })
  threshold: number; // Percentage (0-100) or amount depending on type

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: false })
  triggered: boolean;

  @Prop()
  triggeredAt?: Date;

  @Prop()
  message?: string;
}

@Schema()
export class CategoryBudget {
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  allocatedAmount: number;

  @Prop({ default: 0, min: 0 })
  spentAmount: number;

  @Prop({ default: 0, min: 0 })
  remainingAmount: number;

  @Prop({ type: [BudgetAlert], default: [] })
  alerts: BudgetAlert[];

  @Prop({ default: true })
  trackTransactions: boolean;
}

@Schema({ timestamps: true })
export class Budget {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  name: string;

  @Prop({ trim: true, maxlength: 500 })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  accountId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy: Types.ObjectId; // User ObjectId

  @Prop({ enum: Currency, default: Currency.USD })
  currency: Currency;

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ default: 0, min: 0 })
  spentAmount: number;

  @Prop({ default: 0, min: 0 })
  remainingAmount: number;

  @Prop({ enum: BudgetPeriod, default: BudgetPeriod.MONTHLY })
  period: BudgetPeriod;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ enum: BudgetStatus, default: BudgetStatus.ACTIVE })
  status: BudgetStatus;

  @Prop({ type: [CategoryBudget], default: [] })
  categoryBudgets: CategoryBudget[];

  @Prop({ type: [BudgetAlert], default: [] })
  globalAlerts: BudgetAlert[];

  @Prop({ default: true })
  autoRenew: boolean; // Automatically create next period budget

  @Prop()
  renewedFromId?: Types.ObjectId; // Reference to previous budget if auto-renewed

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [], index: true })
  allowedUsers: Types.ObjectId[]; // User ObjectIds who can view this budget

  @Prop({ default: false })
  isTemplate: boolean; // Can be used as template for new budgets

  @Prop({ type: Object, default: {} })
  metadata: {
    source?: string; // 'manual', 'template', 'ai_suggested', 'auto_renewed'
    tags?: string[];
    notes?: string;
    lastRecalculated?: Date;
    trackingEnabled?: boolean;
    notificationsEnabled?: boolean;
    rolloverUnspent?: boolean; // Rollover unspent amount to next period
  };

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  deletedBy?: Types.ObjectId;
}

export const BudgetSchema = SchemaFactory.createForClass(Budget);

// Critical compound indexes for performance (from MEJORAS.md DB-002)
// Account-based budget queries with period and status filtering
BudgetSchema.index(
  { accountId: 1, period: 1, status: 1, isDeleted: 1 },
  {
    name: 'account_period_status_deleted_idx',
    background: true
  }
);

// Date range queries for budget periods
BudgetSchema.index(
  { accountId: 1, startDate: 1, endDate: 1, isDeleted: 1 },
  {
    name: 'account_date_range_deleted_idx',
    background: true
  }
);

// Creator-based budget queries
BudgetSchema.index(
  { createdBy: 1, status: 1, isDeleted: 1 },
  {
    name: 'creator_status_deleted_idx',
    background: true
  }
);

// Budget expiration and renewal processing
BudgetSchema.index(
  { status: 1, endDate: 1, autoRenew: 1 },
  {
    name: 'status_enddate_renewal_idx',
    background: true
  }
);

// Auto-renewal processing
BudgetSchema.index(
  { autoRenew: 1, endDate: 1, status: 1, isDeleted: 1 },
  {
    name: 'auto_renewal_processing_idx',
    background: true
  }
);

// Template budget queries
BudgetSchema.index(
  { isTemplate: 1, accountId: 1, isDeleted: 1 },
  {
    name: 'template_account_deleted_idx',
    background: true
  }
);

// User access control queries
BudgetSchema.index(
  { allowedUsers: 1, status: 1, isDeleted: 1 },
  {
    name: 'allowed_users_status_deleted_idx',
    background: true
  }
);

// Budget tracking and monitoring
BudgetSchema.index(
  { accountId: 1, status: 1, endDate: -1 },
  {
    name: 'account_status_enddate_idx',
    background: true
  }
);

// Category budget analysis queries
BudgetSchema.index(
  { 'categoryBudgets.categoryId': 1, status: 1, isDeleted: 1 },
  {
    name: 'category_budget_status_deleted_idx',
    background: true
  }
);

// Currency and amount-based queries
BudgetSchema.index(
  { accountId: 1, currency: 1, status: 1 },
  {
    name: 'account_currency_status_idx',
    background: true
  }
);

// Text search for budget names and descriptions
BudgetSchema.index(
  {
    name: 'text',
    description: 'text'
  },
  {
    name: 'budget_text_search',
    weights: { name: 10, description: 5 }
  }
);

// Pre-save middleware to calculate remaining amounts
BudgetSchema.pre('save', function () {
  if (this.isModified('totalAmount') || this.isModified('spentAmount')) {
    this.remainingAmount = Math.max(0, this.totalAmount - this.spentAmount);
  }

  // Update category remaining amounts
  if (this.categoryBudgets && this.categoryBudgets.length > 0) {
    this.categoryBudgets.forEach(categoryBudget => {
      categoryBudget.remainingAmount = Math.max(0, categoryBudget.allocatedAmount - categoryBudget.spentAmount);
    });
  }
});
