import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Document, Types} from 'mongoose';

export type PaymentDocument = Payment & Document;

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
export class Payment {
  @Prop({type: Types.ObjectId, ref: 'User', required: true})
  userId: Types.ObjectId;

  @Prop({type: Types.ObjectId, ref: 'Subscription'})
  subscriptionId?: Types.ObjectId;

  // Stripe payment fields
  @Prop({required: true, unique: true})
  stripePaymentIntentId: string;

  @Prop()
  stripeChargeId?: string;

  @Prop({required: true})
  stripeCustomerId: string;

  // Payment details
  @Prop({required: true})
  amount: number; // Amount in cents

  @Prop({required: true, default: 'usd'})
  currency: string;

  @Prop({
    type: String,
    enum: ['succeeded', 'pending', 'failed', 'canceled', 'refunded', 'partially_refunded'],
    required: true
  })
  status: 'succeeded' | 'pending' | 'failed' | 'canceled' | 'refunded' | 'partially_refunded';

  @Prop({
    type: String,
    enum: ['subscription', 'one_time', 'upgrade', 'downgrade', 'addon'],
    required: true
  })
  type: 'subscription' | 'one_time' | 'upgrade' | 'downgrade' | 'addon';

  // Payment method information
  @Prop({
    type: {
      type: {type: String, enum: ['card', 'bank_account', 'paypal', 'apple_pay', 'google_pay']},
      last4: String,
      brand: String,
      expMonth: Number,
      expYear: Number,
      country: String
    }
  })
  paymentMethod?: {
    type: 'card' | 'bank_account' | 'paypal' | 'apple_pay' | 'google_pay';
    last4?: string;
    brand?: string;
    expMonth?: number;
    expYear?: number;
    country?: string;
  };

  // Transaction details
  @Prop()
  description?: string;

  @Prop()
  receiptUrl?: string;

  @Prop()
  receiptNumber?: string;

  // Billing information
  @Prop({
    type: {
      name: String,
      email: String,
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
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };

  // Refund information
  @Prop()
  refundedAmount?: number; // Amount refunded in cents

  @Prop()
  refundReason?: string;

  @Prop()
  refundedAt?: Date;

  // Dispute information
  @Prop({default: false})
  disputed: boolean;

  @Prop()
  disputeReason?: string;

  @Prop()
  disputedAt?: Date;

  // Processing information
  @Prop()
  processedAt?: Date;

  @Prop()
  failureCode?: string;

  @Prop()
  failureMessage?: string;

  // Invoice information
  @Prop()
  invoiceId?: string;

  @Prop()
  invoiceNumber?: string;

  // Metadata
  @Prop({type: Object, default: {}})
  metadata: Record<string, any>;

  // Timestamps
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Note: Indexes are managed centrally through DatabasePerformanceService
PaymentSchema.index({createdAt: -1});
PaymentSchema.index({disputed: 1});
