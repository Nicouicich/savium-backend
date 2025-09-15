import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReferralRewardDocument = ReferralReward & Document;

export enum RewardType {
  CASH = 'cash',
  CREDIT = 'credit',
  DISCOUNT = 'discount',
  BONUS = 'bonus'
}

export enum RewardStatus {
  PENDING = 'pending',
  AVAILABLE = 'available',
  REDEEMED = 'redeemed',
  EXPIRED = 'expired'
}

export enum RedemptionMethod {
  BANK_TRANSFER = 'bank_transfer',
  PAYPAL = 'paypal',
  GIFT_CARD = 'gift_card',
  ACCOUNT_CREDIT = 'account_credit',
  CRYPTO = 'crypto'
}

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
export class ReferralReward {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  })
  userId: Types.ObjectId; // Who receives the reward

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  })
  referredUserId: Types.ObjectId; // Who was referred

  @Prop({
    type: String,
    enum: RewardType,
    required: true,
    default: RewardType.CASH
  })
  rewardType: RewardType;

  @Prop({
    type: Number,
    required: true,
    min: 0
  })
  amount: number;

  @Prop({
    type: String,
    default: 'USD',
    uppercase: true
  })
  currency: string;

  @Prop({
    type: String,
    enum: RewardStatus,
    required: true,
    default: RewardStatus.PENDING,
    index: true
  })
  status: RewardStatus;

  @Prop({
    type: String,
    enum: RedemptionMethod
  })
  redemptionMethod?: RedemptionMethod;

  @Prop({ type: Object })
  redemptionDetails?: Record<string, any>;

  @Prop()
  redeemedAt?: Date;

  @Prop({
    type: Date,
    index: true
  })
  expiresAt?: Date;

  // Audit fields
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const ReferralRewardSchema = SchemaFactory.createForClass(ReferralReward);

// Compound indexes for efficient queries
ReferralRewardSchema.index(
  { userId: 1, status: 1 },
  {
    name: 'user_status_idx',
    background: true
  }
);

ReferralRewardSchema.index(
  { userId: 1, createdAt: -1 },
  {
    name: 'user_created_idx',
    background: true
  }
);

ReferralRewardSchema.index(
  { referredUserId: 1, status: 1 },
  {
    name: 'referred_status_idx',
    background: true
  }
);

ReferralRewardSchema.index(
  { status: 1, expiresAt: 1 },
  {
    name: 'status_expiry_idx',
    background: true
  }
);

ReferralRewardSchema.index(
  { userId: 1, rewardType: 1, status: 1 },
  {
    name: 'user_type_status_idx',
    background: true
  }
);

// TTL index for expired rewards cleanup (optional)
ReferralRewardSchema.index(
  { expiresAt: 1 },
  {
    name: 'expiry_ttl_idx',
    background: true,
    partialFilterExpression: { expiresAt: { $exists: true } }
  }
);

// Virtual to populate user details
ReferralRewardSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual to populate referred user details
ReferralRewardSchema.virtual('referredUser', {
  ref: 'User',
  localField: 'referredUserId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
ReferralRewardSchema.set('toJSON', { virtuals: true });
ReferralRewardSchema.set('toObject', { virtuals: true });
