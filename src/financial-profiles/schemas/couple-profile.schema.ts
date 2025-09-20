import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseProfile } from './base-profile.schema';

export type CoupleProfileDocument = CoupleProfile & Document;

@Schema({
  timestamps: true,
  collection: 'coupleprofiles',
  toJSON: {
    transform: (doc, ret) => {
      (ret as any).id = (ret as any)._id;
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
})
export class CoupleProfile extends BaseProfile {
  // Couple specific fields
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  partnerId: Types.ObjectId; // The partner's user ID

  @Prop({
    type: String,
    enum: ['pending', 'accepted', 'active', 'separated'],
    default: 'pending',
    index: true
  })
  relationshipStatus: 'pending' | 'accepted' | 'active' | 'separated';

  @Prop({ type: Date })
  relationshipStartDate?: Date;

  // Couple financial settings
  @Prop({
    type: {
      sharedTransactionApproval: { type: Boolean, default: false },
      transactionApprovalThreshold: { type: Number, default: 100 },
      allowPartnerToViewTransactions: { type: Boolean, default: true },
      allowPartnerToCreateBudgets: { type: Boolean, default: true },
      sharedCategories: [{ type: String }],
      privateCategories: [{ type: String }]
    },
    default: {}
  })
  coupleSettings: {
    sharedTransactionApproval: boolean;
    transactionApprovalThreshold: number;
    allowPartnerToViewTransactions: boolean;
    allowPartnerToCreateBudgets: boolean;
    sharedCategories: string[];
    privateCategories: string[];
  };

  // Shared financial goals
  @Prop([
    {
      type: {
        name: { type: String, required: true },
        targetAmount: { type: Number, required: true },
        currentAmount: { type: Number, default: 0 },
        targetDate: { type: Date },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        isCompleted: { type: Boolean, default: false },
        contributions: [
          {
            userId: { type: Types.ObjectId, ref: 'User' },
            amount: { type: Number },
            date: { type: Date, default: Date.now }
          }
        ]
      }
    }
  ])
  sharedGoals: {
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: Date;
    priority: 'low' | 'medium' | 'high';
    isCompleted: boolean;
    contributions: {
      userId: Types.ObjectId;
      amount: number;
      date: Date;
    }[];
  }[];

  // Couple financial tracking
  @Prop({
    type: {
      totalSharedTransactions: { type: Number, default: 0 },
      partner1Contribution: { type: Number, default: 0 },
      partner2Contribution: { type: Number, default: 0 },
      lastCalculatedAt: { type: Date, default: Date.now }
    },
    default: {}
  })
  financialSummary: {
    totalSharedTransactions: number;
    partner1Contribution: number;
    partner2Contribution: number;
    lastCalculatedAt: Date;
  };

  // Activity and interaction tracking
  @Prop([
    {
      type: {
        transactionId: { type: Types.ObjectId, ref: 'Transaction' },
        userId: { type: Types.ObjectId, ref: 'User' },
        comment: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    }
  ])
  transactionComments: {
    transactionId: Types.ObjectId;
    userId: Types.ObjectId;
    comment: string;
    createdAt: Date;
  }[];

  @Prop([
    {
      type: {
        transactionId: { type: Types.ObjectId, ref: 'Transaction' },
        userId: { type: Types.ObjectId, ref: 'User' },
        reaction: { type: String, enum: ['like', 'love', 'surprised', 'angry'] },
        createdAt: { type: Date, default: Date.now }
      }
    }
  ])
  transactionReactions: {
    transactionId: Types.ObjectId;
    userId: Types.ObjectId;
    reaction: 'like' | 'love' | 'surprised' | 'angry';
    createdAt: Date;
  }[];
}

export const CoupleProfileSchema = SchemaFactory.createForClass(CoupleProfile);

// Indexes for CoupleProfile
CoupleProfileSchema.index({ userId: 1, partnerId: 1 }, { name: 'couple_users_idx', unique: true });
CoupleProfileSchema.index({ partnerId: 1, relationshipStatus: 1 }, { name: 'partner_status_idx' });
CoupleProfileSchema.index({ relationshipStatus: 1, createdAt: -1 }, { name: 'status_created_idx' });
CoupleProfileSchema.index({ userId: 1, status: 1 }, { name: 'user_status_idx' });
