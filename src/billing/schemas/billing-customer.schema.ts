import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Document, Types} from 'mongoose';

export type BillingCustomerDocument = BillingCustomer & Document;

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
export class BillingCustomer {
  @Prop({type: Types.ObjectId, ref: 'User', required: true, unique: true})
  userId: Types.ObjectId;

  // Stripe customer information
  @Prop({required: true, unique: true})
  stripeCustomerId: string;

  // Customer details
  @Prop({required: true})
  email: string;

  @Prop()
  name?: string;

  @Prop()
  phone?: string;

  // Billing address
  @Prop({
    type: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    }
  })
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  // Tax information
  @Prop()
  taxId?: string; // VAT number, SSN, etc.

  @Prop({
    type: String,
    enum: ['individual', 'company']
  })
  taxIdType?: 'individual' | 'company';

  @Prop()
  businessName?: string;

  // Payment methods (stored references only)
  @Prop([
    {
      stripePaymentMethodId: {type: String, required: true},
      type: {type: String, enum: ['card', 'bank_account'], required: true},
      last4: String,
      brand: String,
      expMonth: Number,
      expYear: Number,
      isDefault: {type: Boolean, default: false},
      createdAt: {type: Date, default: Date.now}
    }
  ])
  paymentMethods: {
    stripePaymentMethodId: string;
    type: 'card' | 'bank_account';
    last4: string;
    brand?: string;
    expMonth?: number;
    expYear?: number;
    isDefault: boolean;
    createdAt: Date;
  }[];

  // Billing preferences
  @Prop({
    type: {
      currency: {type: String, default: 'usd'},
      invoiceDelivery: {
        type: String,
        enum: ['email', 'postal'],
        default: 'email'
      },
      autoPayment: {type: Boolean, default: true},
      billingThreshold: Number // Alert when balance goes below this amount
    },
    default: {}
  })
  preferences: {
    currency: string;
    invoiceDelivery: 'email' | 'postal';
    autoPayment: boolean;
    billingThreshold?: number;
  };

  // Credit and balance information
  @Prop({default: 0})
  accountBalance: number; // Negative = credit, Positive = amount owed

  @Prop({default: 0})
  creditBalance: number; // Available credits

  // Customer status
  @Prop({
    type: String,
    enum: ['active', 'inactive', 'delinquent', 'suspended'],
    default: 'active'
  })
  status: 'active' | 'inactive' | 'delinquent' | 'suspended';

  // Subscription relationship
  @Prop({type: Types.ObjectId, ref: 'Subscription'})
  activeSubscriptionId?: Types.ObjectId;

  // Communication preferences
  @Prop({
    type: {
      billingEmails: {type: Boolean, default: true},
      marketingEmails: {type: Boolean, default: false},
      productUpdates: {type: Boolean, default: true},
      securityAlerts: {type: Boolean, default: true}
    },
    default: {}
  })
  emailPreferences: {
    billingEmails: boolean;
    marketingEmails: boolean;
    productUpdates: boolean;
    securityAlerts: boolean;
  };

  // Risk and fraud prevention
  @Prop({default: 0})
  riskScore: number; // 0-100, higher = more risky

  @Prop([
    {
      type: {type: String, enum: ['chargeback', 'refund_request', 'dispute']},
      date: {type: Date, default: Date.now},
      amount: Number,
      reason: String,
      resolved: {type: Boolean, default: false}
    }
  ])
  riskEvents: {
    type: 'chargeback' | 'refund_request' | 'dispute';
    date: Date;
    amount: number;
    reason: string;
    resolved: boolean;
  }[];

  // Metadata for extensibility
  @Prop({type: Object, default: {}})
  metadata: Record<string, any>;

  // Audit fields
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const BillingCustomerSchema = SchemaFactory.createForClass(BillingCustomer);

// Note: Indexes are managed centrally through DatabasePerformanceService
BillingCustomerSchema.index({activeSubscriptionId: 1});
BillingCustomerSchema.index({'paymentMethods.stripePaymentMethodId': 1});
BillingCustomerSchema.index({riskScore: -1}); // Higher risk first
BillingCustomerSchema.index({createdAt: -1});
