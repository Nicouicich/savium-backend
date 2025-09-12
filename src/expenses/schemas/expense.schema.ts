import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Currency, PaymentMethod } from '@common/constants/expense-categories';

export type ExpenseDocument = Expense & Document;

@Schema()
export class AttachedFile {
  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  path: string;

  @Prop()
  url?: string;

  @Prop({ type: Date, default: Date.now })
  uploadedAt: Date;
}

@Schema()
export class ExpenseMetadata {
  @Prop()
  source?: string; // 'manual', 'whatsapp', 'telegram', 'ai_processed'

  @Prop()
  confidence?: number; // AI confidence score (0-1)

  @Prop({ type: Object, default: {} })
  aiAnalysis?: Record<string, any>;

  @Prop({ type: Object })
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  receiptText?: string; // Extracted text from receipt

  @Prop({ type: Object, default: {} })
  additional?: Record<string, any>;
}

@Schema({ timestamps: true })
export class Expense {
  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ enum: Currency, default: Currency.USD })
  currency: Currency;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop()
  subcategoryName?: string;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  accountId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ enum: PaymentMethod, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @Prop({ trim: true })
  vendor?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: [AttachedFile], default: [] })
  attachedFiles: AttachedFile[];

  @Prop({ default: false })
  isRecurring: boolean;

  @Prop({ type: Object })
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number; // Every X days/weeks/months/years
    endDate?: Date;
    nextOccurrence?: Date;
  };

  @Prop({ default: false })
  isSharedExpense: boolean;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  sharedWith: Types.ObjectId[];

  @Prop({ type: Object })
  splitDetails?: {
    totalAmount: number;
    splits: {
      userId: Types.ObjectId;
      amount: number;
      percentage?: number;
      paid: boolean;
    }[];
    splitMethod: 'equal' | 'percentage' | 'amount';
  };

  @Prop({ default: false })
  needsReview: boolean;

  @Prop()
  reviewReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ default: 'active' })
  status: string; // 'active', 'pending_approval', 'approved', 'rejected'

  @Prop({ type: ExpenseMetadata, default: {} })
  metadata: ExpenseMetadata;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ default: false })
  isFlagged: boolean;

  @Prop()
  flagReason?: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  deletedBy?: Types.ObjectId;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);

// Note: Indexes are managed centrally through DatabasePerformanceService
// to avoid duplicates and conflicts. See src/database/indexes.ts

// Text search index for description and vendor
ExpenseSchema.index(
  {
    description: 'text',
    vendor: 'text',
    notes: 'text'
  },
  {
    name: 'expense_text_search',
    weights: { description: 10, vendor: 5, notes: 1 }
  }
);

// Sparse index for review-related queries
ExpenseSchema.index({ accountId: 1, needsReview: 1 }, { sparse: true });

// Index for flagged expenses monitoring
ExpenseSchema.index({ isFlagged: 1, accountId: 1 }, { sparse: true });

// Critical compound indexes for performance (from MEJORAS.md DB-002)
// Most common query pattern: expenses by account and date (for reports and listings)
ExpenseSchema.index(
  { accountId: 1, date: -1 },
  {
    name: 'account_date_idx',
    background: true
  }
);

// Common query pattern: expenses by user with soft delete filtering
ExpenseSchema.index(
  { userId: 1, isDeleted: 1 },
  {
    name: 'user_deleted_idx',
    background: true
  }
);

// Common query pattern: expenses by category sorted by amount (for analytics)
ExpenseSchema.index(
  { categoryId: 1, amount: -1 },
  {
    name: 'category_amount_idx',
    background: true
  }
);

// Account-based queries with status filtering (for approval workflows)
ExpenseSchema.index(
  { accountId: 1, status: 1, createdAt: -1 },
  {
    name: 'account_status_created_idx',
    background: true
  }
);

// Date range queries with account filtering (for reports)
ExpenseSchema.index(
  { accountId: 1, date: -1, isDeleted: 1 },
  {
    name: 'account_date_deleted_idx',
    background: true
  }
);

// Recurring expenses processing
ExpenseSchema.index(
  { isRecurring: 1, 'recurringPattern.nextOccurrence': 1 },
  {
    name: 'recurring_next_occurrence_idx',
    background: true,
    sparse: true
  }
);

// Shared expenses queries
ExpenseSchema.index(
  { accountId: 1, isSharedExpense: 1, sharedWith: 1 },
  {
    name: 'account_shared_users_idx',
    background: true,
    sparse: true
  }
);

// Performance index for amount-based queries and sorting
ExpenseSchema.index(
  { accountId: 1, amount: -1, date: -1 },
  {
    name: 'account_amount_date_idx',
    background: true
  }
);
