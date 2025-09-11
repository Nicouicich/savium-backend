import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Document, Types} from 'mongoose';

export type EnhancedPaymentDocument = EnhancedPayment & Document;

@Schema({
  timestamps: true,
  collection: 'payments_enhanced',
  toJSON: {
    transform: (doc, ret) => {
      (ret as any).id = (ret as any)._id;
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
})
export class EnhancedPayment {
  @Prop({type: Types.ObjectId, ref: 'User', required: true})
  userId: Types.ObjectId;

  @Prop({type: Types.ObjectId, ref: 'Account'})
  accountId?: Types.ObjectId;

  @Prop({type: Types.ObjectId, ref: 'Subscription'})
  subscriptionId?: Types.ObjectId;

  // Stripe payment identifiers
  @Prop({required: true, unique: true})
  stripePaymentIntentId: string;

  @Prop()
  stripeChargeId?: string;

  @Prop({required: true})
  stripeCustomerId: string;

  @Prop()
  stripePaymentMethodId?: string;

  @Prop()
  stripeClientSecret?: string;

  // Payment details
  @Prop({required: true})
  amount: number; // Amount in major currency unit (e.g., dollars)

  @Prop({required: true, default: 'usd'})
  currency: string;

  @Prop({
    type: String,
    enum: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'canceled', 'succeeded', 'failed'],
    required: true,
    default: 'requires_payment_method'
  })
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded' | 'failed';

  @Prop({
    type: String,
    enum: ['stripe', 'manual', 'bank_transfer'],
    required: true,
    default: 'stripe'
  })
  paymentMethod: 'stripe' | 'manual' | 'bank_transfer';

  @Prop({
    type: String,
    enum: ['subscription', 'one_time', 'upgrade', 'downgrade', 'addon', 'setup'],
    required: true
  })
  type: 'subscription' | 'one_time' | 'upgrade' | 'downgrade' | 'addon' | 'setup';

  // Payment method details
  @Prop({
    type: {
      type: {type: String, enum: ['card', 'us_bank_account', 'sepa_debit', 'ideal', 'giropay', 'sofort', 'bancontact', 'eps', 'p24', 'alipay', 'wechat_pay']},
      last4: String,
      brand: String,
      expMonth: Number,
      expYear: Number,
      country: String,
      wallet: String,
      bankName: String,
      fingerprint: String
    }
  })
  paymentMethodDetails?: {
    type: 'card' | 'us_bank_account' | 'sepa_debit' | 'ideal' | 'giropay' | 'sofort' | 'bancontact' | 'eps' | 'p24' | 'alipay' | 'wechat_pay';
    last4?: string;
    brand?: string;
    expMonth?: number;
    expYear?: number;
    country?: string;
    wallet?: string;
    bankName?: string;
    fingerprint?: string;
  };

  // Transaction details
  @Prop()
  description?: string;

  @Prop()
  receiptUrl?: string;

  @Prop()
  receiptNumber?: string;

  @Prop()
  stripeConfirmationMethod?: string;

  @Prop()
  stripeCaptureMethod?: string;

  // Status history for audit trail
  @Prop({
    type: [
      {
        status: String,
        timestamp: {type: Date, default: Date.now},
        metadata: Object
      }
    ],
    default: []
  })
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }>;

  // Billing information
  @Prop({
    type: {
      name: String,
      email: String,
      phone: String,
      address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
      }
    }
  })
  billingDetails?: {
    name: string;
    email: string;
    phone?: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };

  // Financial details
  @Prop()
  applicationFeeAmount?: number;

  @Prop()
  stripeFeeAmount?: number;

  @Prop()
  netAmount?: number;

  // Refund information
  @Prop({default: 0})
  refundedAmount: number; // Amount refunded in major currency unit

  @Prop()
  refundReason?: string;

  @Prop()
  refundedAt?: Date;

  @Prop({
    type: [
      {
        refundId: String,
        amount: Number,
        reason: String,
        status: String,
        createdAt: Date
      }
    ],
    default: []
  })
  refundHistory: Array<{
    refundId: string;
    amount: number;
    reason?: string;
    status: string;
    createdAt: Date;
  }>;

  // Dispute information
  @Prop({default: false})
  disputed: boolean;

  @Prop()
  disputeReason?: string;

  @Prop()
  disputedAt?: Date;

  @Prop({
    type: {
      id: String,
      reason: String,
      status: String,
      evidence: Object,
      evidenceDeadline: Date
    }
  })
  disputeDetails?: {
    id: string;
    reason: string;
    status: string;
    evidence?: Record<string, any>;
    evidenceDeadline?: Date;
  };

  // Processing information
  @Prop()
  processedAt?: Date;

  @Prop()
  failureCode?: string;

  @Prop()
  failureMessage?: string;

  @Prop()
  declineCode?: string;

  // Risk assessment
  @Prop({
    type: {
      level: {type: String, enum: ['normal', 'elevated', 'highest']},
      score: Number,
      reason: String,
      details: Object
    }
  })
  riskAssessment?: {
    level: 'normal' | 'elevated' | 'highest';
    score?: number;
    reason?: string;
    details?: Record<string, any>;
  };

  // Invoice information
  @Prop()
  stripeInvoiceId?: string;

  @Prop()
  invoiceNumber?: string;

  @Prop()
  invoiceUrl?: string;

  // 3D Secure information
  @Prop({
    type: {
      authenticated: Boolean,
      succeeded: Boolean,
      version: String,
      flow: String
    }
  })
  threeDSecure?: {
    authenticated: boolean;
    succeeded: boolean;
    version?: string;
    flow?: string;
  };

  // Webhooks processing
  @Prop({
    type: [
      {
        eventId: String,
        eventType: String,
        processedAt: Date,
        success: Boolean,
        error: String
      }
    ],
    default: []
  })
  webhookEvents: Array<{
    eventId: string;
    eventType: string;
    processedAt: Date;
    success: boolean;
    error?: string;
  }>;

  // External references
  @Prop()
  externalTransactionId?: string;

  @Prop()
  externalOrderId?: string;

  // Metadata
  @Prop({type: Object, default: {}})
  metadata: Record<string, any>;

  // Timestamps
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const EnhancedPaymentSchema = SchemaFactory.createForClass(EnhancedPayment);

// Indexes for performance
EnhancedPaymentSchema.index({userId: 1, createdAt: -1});
EnhancedPaymentSchema.index({accountId: 1, createdAt: -1});
EnhancedPaymentSchema.index({stripePaymentIntentId: 1}, {unique: true});
EnhancedPaymentSchema.index({stripeCustomerId: 1});
EnhancedPaymentSchema.index({stripeChargeId: 1});
EnhancedPaymentSchema.index({status: 1, createdAt: -1});
EnhancedPaymentSchema.index({paymentMethod: 1});
EnhancedPaymentSchema.index({type: 1});
EnhancedPaymentSchema.index({disputed: 1});
EnhancedPaymentSchema.index({currency: 1});
EnhancedPaymentSchema.index({amount: 1});
EnhancedPaymentSchema.index({'riskAssessment.level': 1});

// Compound indexes for common queries
EnhancedPaymentSchema.index({userId: 1, status: 1, createdAt: -1});
EnhancedPaymentSchema.index({accountId: 1, type: 1, createdAt: -1});
EnhancedPaymentSchema.index({stripeCustomerId: 1, status: 1});

// Text index for search
EnhancedPaymentSchema.index({
  description: 'text',
  'billingDetails.name': 'text',
  'billingDetails.email': 'text'
});

// Virtual for computed fields
EnhancedPaymentSchema.virtual('isRefunded').get(function () {
  return this.refundedAmount > 0;
});

EnhancedPaymentSchema.virtual('isPartiallyRefunded').get(function () {
  return this.refundedAmount > 0 && this.refundedAmount < this.amount;
});

EnhancedPaymentSchema.virtual('isFullyRefunded').get(function () {
  return this.refundedAmount >= this.amount;
});

EnhancedPaymentSchema.virtual('remainingAmount').get(function () {
  return Math.max(0, this.amount - this.refundedAmount);
});

// Pre-save middleware
EnhancedPaymentSchema.pre('save', function (next) {
  // Add status change to history
  if (this.isModified('status')) {
    const statusEntry = {
      status: this.status,
      timestamp: new Date(),
      metadata: {
        previousStatus: this.get('_original.status'),
        source: 'application'
      }
    };

    if (!this.statusHistory) {
      this.statusHistory = [];
    }
    this.statusHistory.push(statusEntry);
  }

  next();
});

// Methods
EnhancedPaymentSchema.methods.addWebhookEvent = function (eventId: string, eventType: string, success: boolean, error?: string) {
  this.webhookEvents.push({
    eventId,
    eventType,
    processedAt: new Date(),
    success,
    error
  });
  return this.save();
};

EnhancedPaymentSchema.methods.addRefund = function (refundId: string, amount: number, reason?: string, status: string = 'succeeded') {
  this.refundHistory.push({
    refundId,
    amount,
    reason,
    status,
    createdAt: new Date()
  });

  if (status === 'succeeded') {
    this.refundedAmount += amount;
    this.refundedAt = new Date();
    if (reason) {
      this.refundReason = reason;
    }
  }

  return this.save();
};
