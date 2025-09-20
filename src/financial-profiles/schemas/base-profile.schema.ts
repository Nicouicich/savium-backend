import { Prop } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Category } from 'src/categories/schemas/category.schema';

/**
 * Base class for all financial profile types
 * Contains common fields shared across all profile types
 */
export abstract class BaseProfile {
  // Core profile information
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  // Financial settings
  @Prop({ required: true, default: 'USD' })
  currency: string;

  @Prop({ required: true, default: 'UTC' })
  timezone: string;

  // Profile settings
  @Prop({
    type: {
      privacy: {
        transactionVisibility: { type: String, enum: ['private', 'members', 'public'], default: 'private' },
        reportVisibility: { type: String, enum: ['private', 'members', 'public'], default: 'private' },
        budgetVisibility: { type: String, enum: ['private', 'members', 'public'], default: 'private' },
        allowPrivateTransactions: { type: Boolean, default: true },
        requireApproval: { type: Boolean, default: false }
      },
      notifications: {
        enabled: { type: Boolean, default: true },
        frequency: { type: String, enum: ['real-time', 'daily', 'weekly'], default: 'daily' },
        channels: [{ type: String, enum: ['email', 'push', 'sms'] }]
      },
      preferences: {
        dateFormat: { type: String, default: 'DD/MM/YYYY' },
        timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
        weekStartDay: { type: String, enum: ['monday', 'sunday'], default: 'monday' },
        autoCategorizationEnabled: { type: Boolean, default: true },
        receiptScanningEnabled: { type: Boolean, default: true }
      }
    },
    default: {}
  })
  settings: {
    privacy: {
      transactionVisibility: 'private' | 'members' | 'public';
      reportVisibility: 'private' | 'members' | 'public';
      budgetVisibility: 'private' | 'members' | 'public';
      allowPrivateTransactions: boolean;
      requireApproval: boolean;
    };
    notifications: {
      enabled: boolean;
      frequency: 'real-time' | 'daily' | 'weekly';
      channels: ('email' | 'push' | 'sms')[];
    };
    preferences: {
      dateFormat: string;
      timeFormat: '12h' | '24h';
      weekStartDay: 'monday' | 'sunday';
      autoCategorizationEnabled: boolean;
      receiptScanningEnabled: boolean;
    };
  };

  // Financial data relationships
  @Prop([{ type: Types.ObjectId, ref: 'Transaction' }])
  transactions: Types.ObjectId[];

  @Prop([{ type: Types.ObjectId, ref: 'Budget' }])
  budgets: Types.ObjectId[];

  @Prop([{ type: Types.ObjectId, ref: 'Goal' }])
  goals: Types.ObjectId[];

  @Prop([{ type: Types.ObjectId, ref: 'Category' }])
  categories: Types.ObjectId[] | Category[];

  // Status and metadata
  @Prop({
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active',
    index: true
  })
  status: 'active' | 'inactive' | 'archived';

  @Prop({ type: Date, default: Date.now })
  lastUsedAt: Date;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  // Timestamps
  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}
