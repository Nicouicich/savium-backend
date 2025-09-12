import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      (ret as any).id = (ret as any)._id;
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
})
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  // Stripe integration fields
  @Prop({ required: true, unique: true })
  stripeSubscriptionId: string;

  @Prop({ required: true })
  stripeCustomerId: string;

  @Prop({ required: true })
  stripePriceId: string;

  @Prop({ required: true })
  stripeProductId: string;

  // Subscription details
  @Prop({
    type: String,
    enum: ['free', 'basic', 'premium', 'family', 'business'],
    required: true
  })
  plan: 'free' | 'basic' | 'premium' | 'family' | 'business';

  @Prop({
    type: String,
    enum: ['monthly', 'yearly', 'lifetime'],
    required: true
  })
  interval: 'monthly' | 'yearly' | 'lifetime';

  @Prop({
    type: String,
    enum: ['active', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired'],
    required: true
  })
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'incomplete' | 'incomplete_expired';

  // Pricing information
  @Prop({ required: true })
  amount: number; // Amount in cents

  @Prop({ required: true, default: 'usd' })
  currency: string;

  // Subscription lifecycle
  @Prop({ required: true })
  currentPeriodStart: Date;

  @Prop({ required: true })
  currentPeriodEnd: Date;

  @Prop()
  cancelAt?: Date;

  @Prop()
  canceledAt?: Date;

  @Prop()
  endedAt?: Date;

  @Prop()
  trialStart?: Date;

  @Prop()
  trialEnd?: Date;

  // Features and limits for this subscription
  @Prop({
    type: {
      maxAccounts: { type: Number, default: 1 },
      maxExpensesPerMonth: { type: Number, default: 100 },
      maxBudgets: { type: Number, default: 5 },
      maxGoals: { type: Number, default: 3 },
      aiCategorization: { type: Boolean, default: false },
      advancedReports: { type: Boolean, default: false },
      exportData: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      customCategories: { type: Boolean, default: false },
      multiCurrency: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      whiteLabel: { type: Boolean, default: false }
    },
    required: true
  })
  features: {
    maxAccounts: number;
    maxExpensesPerMonth: number;
    maxBudgets: number;
    maxGoals: number;
    aiCategorization: boolean;
    advancedReports: boolean;
    exportData: boolean;
    prioritySupport: boolean;
    customCategories: boolean;
    multiCurrency: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
  };

  // Usage tracking
  @Prop({
    type: {
      accountsCreated: { type: Number, default: 0 },
      expensesThisMonth: { type: Number, default: 0 },
      budgetsCreated: { type: Number, default: 0 },
      goalsCreated: { type: Number, default: 0 },
      apiCallsThisMonth: { type: Number, default: 0 }
    },
    default: {}
  })
  usage: {
    accountsCreated: number;
    expensesThisMonth: number;
    budgetsCreated: number;
    goalsCreated: number;
    apiCallsThisMonth: number;
  };

  // Metadata
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  // Timestamps for tracking
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// Critical compound indexes for performance (from MEJORAS.md DB-002)
// User subscription lookup
SubscriptionSchema.index(
  { userId: 1, status: 1 },
  {
    name: 'user_status_idx',
    background: true
  }
);

// Stripe integration queries
SubscriptionSchema.index(
  { stripeCustomerId: 1, status: 1 },
  {
    name: 'stripe_customer_status_idx',
    background: true
  }
);

// Plan and status analytics
SubscriptionSchema.index(
  { plan: 1, status: 1, interval: 1 },
  {
    name: 'plan_status_interval_idx',
    background: true
  }
);

// Billing cycle processing
SubscriptionSchema.index(
  { status: 1, currentPeriodEnd: 1 },
  {
    name: 'status_period_end_idx',
    background: true
  }
);

// Active subscription monitoring
SubscriptionSchema.index(
  { status: 1, currentPeriodStart: 1, currentPeriodEnd: 1 },
  {
    name: 'status_period_range_idx',
    background: true
  }
);

// Trial period tracking
SubscriptionSchema.index(
  { status: 1, trialEnd: 1 },
  {
    name: 'status_trial_end_idx',
    background: true,
    sparse: true
  }
);

// Cancellation tracking
SubscriptionSchema.index(
  { status: 1, cancelAt: 1 },
  {
    name: 'status_cancel_at_idx',
    background: true,
    sparse: true
  }
);

// Feature usage analytics
SubscriptionSchema.index(
  { plan: 1, 'features.maxAccounts': 1 },
  {
    name: 'plan_max_accounts_idx',
    background: true
  }
);

// Currency-based filtering
SubscriptionSchema.index(
  { currency: 1, status: 1 },
  {
    name: 'currency_status_idx',
    background: true
  }
);

// User activity tracking
SubscriptionSchema.index(
  { userId: 1, createdAt: -1 },
  {
    name: 'user_created_idx',
    background: true
  }
);

// Stripe product and price tracking
SubscriptionSchema.index(
  { stripeProductId: 1, stripePriceId: 1 },
  {
    name: 'stripe_product_price_idx',
    background: true
  }
);
