import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Currency, PaymentMethod } from '@common/constants/transaction-categories';
import { CoupleTransactionType, CoupleReactionType } from '@common/constants/couple-types';
import { CategoryDocument } from 'src/categories/schemas/category.schema';

export type TransactionDocument = Transaction &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema()
export class AttachedFile {
  @Prop({ required: true })
  fileId: string; // References FileMetadata.fileId

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  fileType: string; // image, audio, document, video

  @Prop()
  purpose?: string; // receipt, invoice, proof_of_payment, etc.

  @Prop()
  url?: string; // Direct S3 URL or CDN URL

  @Prop({ type: Date, default: Date.now })
  attachedAt: Date;

  @Prop()
  uploadSource?: string; // whatsapp, telegram, web, mobile

  // Legacy fields for backward compatibility (deprecated)
  @Prop()
  filename?: string; // @deprecated: use fileId instead

  @Prop()
  path?: string; // @deprecated: use S3 key from FileMetadata instead
}

@Schema()
export class TransactionComment {
  @Prop({ type: String, required: true, index: true })
  userId: string; // User UUID

  @Prop({ required: true, trim: true })
  text: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date })
  editedAt?: Date;

  @Prop({ default: false })
  isEdited: boolean;
}

@Schema()
export class TransactionReaction {
  @Prop({ type: String, required: true, index: true })
  userId: string; // User UUID

  @Prop({ type: String, enum: CoupleReactionType, required: true })
  type: CoupleReactionType;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

@Schema()
export class CoupleTransactionData {
  @Prop({
    type: String,
    enum: Object.values(CoupleTransactionType),
    default: CoupleTransactionType.SHARED
  })
  transactionType: CoupleTransactionType;

  // For shared transactions - split details
  @Prop({
    type: {
      partner1UserId: { type: String },
      partner2UserId: { type: String },
      partner1Amount: { type: Number, min: 0 },
      partner2Amount: { type: Number, min: 0 },
      splitMethod: {
        type: String,
        enum: ['equal', 'percentage', 'amount'],
        default: 'equal'
      },
      partner1Percentage: { type: Number, min: 0, max: 100 },
      partner2Percentage: { type: Number, min: 0, max: 100 }
    }
  })
  splitDetails?: {
    partner1UserId: string; // User UUID
    partner2UserId: string; // User UUID
    partner1Amount: number;
    partner2Amount: number;
    splitMethod: 'equal' | 'percentage' | 'amount';
    partner1Percentage?: number;
    partner2Percentage?: number;
  };

  // Gift mode
  @Prop({ default: false })
  isGift: boolean;

  @Prop({ type: String, index: true })
  giftFor?: string; // User UUID

  @Prop({ type: Date })
  revealDate?: Date;

  @Prop({ default: false })
  isRevealed: boolean;

  @Prop({ type: Date })
  revealedAt?: Date;

  // Comments and reactions (couple-specific features)
  @Prop({ type: [TransactionComment], default: [] })
  comments: TransactionComment[];

  @Prop({ type: [TransactionReaction], default: [] })
  reactions: TransactionReaction[];

  // Settlement tracking
  @Prop({ default: false })
  isSettled: boolean;

  @Prop({ type: Date })
  settledAt?: Date;

  @Prop({ type: String, index: true })
  settledBy?: string; // User UUID
}

@Schema()
export class TransactionMetadata {
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

  // Context parsing information
  @Prop()
  parsedContext?: string; // 'couple', 'personal', 'family', 'business'

  @Prop()
  originalContext?: string; // Original @context from message

  @Prop()
  contextConfidence?: number; // Confidence in parsed context (0-1)
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: String, enum: Currency, default: Currency.USD })
  currency: Currency;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: false })
  categoryId?: Types.ObjectId | CategoryDocument;

  @Prop()
  subcategoryName?: string;

  @Prop({ type: Types.ObjectId, ref: 'Profile', required: true })
  profileId: Types.ObjectId;

  @Prop({ type: String, enum: PaymentMethod, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;
  // New payment method fields for card integration
  @Prop({ type: Types.ObjectId, ref: 'PaymentMethod' })
  paymentMethodId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Card' })
  cardId?: Types.ObjectId;

  @Prop({ trim: true })
  transactionReference?: string; // External transaction ID

  @Prop({ trim: true })
  vendor?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: [AttachedFile], default: [] })
  attachedFiles: AttachedFile[];

  // New file references using our S3 file system
  @Prop({ type: [String], default: [] })
  fileIds: string[]; // Array of FileMetadata.fileId references

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
  isSharedTransaction: boolean;

  @Prop({ type: [String], default: [], index: true })
  sharedWith: string[]; // User UUIDs

  @Prop({ type: Object })
  splitDetails?: {
    totalAmount: number;
    splits: {
      userId: string; // User UUID
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

  @Prop({ type: String, index: true })
  reviewedBy?: string; // User UUID

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ default: 'active' })
  status: string; // 'active', 'pending_approval', 'approved', 'rejected'

  @Prop({ type: TransactionMetadata, default: {} })
  metadata: TransactionMetadata;

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

  @Prop({ type: String, index: true })
  deletedBy?: string; // User UUID

  // Couple-specific data (only for couple account transactions)
  @Prop({ type: CoupleTransactionData })
  coupleData?: CoupleTransactionData;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Note: Indexes are managed centrally through DatabasePerformanceService
// to avoid duplicates and conflicts. See src/database/indexes.ts

// Text search index for description and vendor
TransactionSchema.index(
  {
    description: 'text',
    vendor: 'text',
    notes: 'text'
  },
  {
    name: 'transaction_text_search',
    weights: { description: 10, vendor: 5, notes: 1 }
  }
);

// Sparse index for review-related queries
TransactionSchema.index({ profileId: 1, needsReview: 1 }, { sparse: true });

// Index for flagged transactions monitoring
TransactionSchema.index({ isFlagged: 1, profileId: 1 }, { sparse: true });

// Critical compound indexes for performance (from MEJORAS.md DB-002)
// Most common query pattern: transactions by account and date (for reports and listings)
TransactionSchema.index(
  { profileId: 1, date: -1 },
  {
    name: 'profile_date_idx',
    background: true
  }
);

// Common query pattern: transactions by user with soft delete filtering
TransactionSchema.index(
  { userId: 1, isDeleted: 1 },
  {
    name: 'user_deleted_idx',
    background: true
  }
);

// Common query pattern: transactions by category sorted by amount (for analytics)
TransactionSchema.index(
  { categoryId: 1, amount: -1 },
  {
    name: 'category_amount_idx',
    background: true
  }
);

// Account-based queries with status filtering (for approval workflows)
TransactionSchema.index(
  { profileId: 1, status: 1, createdAt: -1 },
  {
    name: 'profile_status_created_idx',
    background: true
  }
);

// Date range queries with account filtering (for reports)
TransactionSchema.index(
  { profileId: 1, date: -1, isDeleted: 1 },
  {
    name: 'profile_date_deleted_idx',
    background: true
  }
);

// Recurring transactions processing
TransactionSchema.index(
  { isRecurring: 1, 'recurringPattern.nextOccurrence': 1 },
  {
    name: 'recurring_next_occurrence_idx',
    background: true,
    sparse: true
  }
);

// Shared transactions queries
TransactionSchema.index(
  { profileId: 1, isSharedTransaction: 1, sharedWith: 1 },
  {
    name: 'profile_shared_users_idx',
    background: true,
    sparse: true
  }
);

// Performance index for amount-based queries and sorting
TransactionSchema.index(
  { profileId: 1, amount: -1, date: -1 },
  {
    name: 'profile_amount_date_idx',
    background: true
  }
);

// Couple-specific indexes
TransactionSchema.index(
  { profileId: 1, 'coupleData.transactionType': 1, date: -1 },
  {
    name: 'couple_transaction_type_date_idx',
    background: true,
    sparse: true
  }
);

TransactionSchema.index(
  { profileId: 1, 'coupleData.isGift': 1, 'coupleData.revealDate': 1 },
  {
    name: 'couple_gift_reveal_idx',
    background: true,
    sparse: true
  }
);

TransactionSchema.index(
  { profileId: 1, 'coupleData.isSettled': 1, createdAt: -1 },
  {
    name: 'couple_settlement_status_idx',
    background: true,
    sparse: true
  }
);

TransactionSchema.index(
  { 'coupleData.splitDetails.partner1UserId': 1, 'coupleData.splitDetails.partner2UserId': 1 },
  {
    name: 'couple_split_partners_idx',
    background: true,
    sparse: true
  }
);

TransactionSchema.index(
  { profileId: 1, 'coupleData.comments.userId': 1, 'coupleData.comments.createdAt': -1 },
  {
    name: 'couple_comments_user_date_idx',
    background: true,
    sparse: true
  }
);

TransactionSchema.index(
  { 'metadata.parsedContext': 1, userId: 1, date: -1 },
  {
    name: 'context_user_date_idx',
    background: true,
    sparse: true
  }
);

// Additional indexes for card integration
TransactionSchema.index({ paymentMethodId: 1, cardId: 1, createdAt: -1 });
TransactionSchema.index({ cardId: 1, createdAt: -1 });
TransactionSchema.index({ paymentMethodId: 1, createdAt: -1 });
