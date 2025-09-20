import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseProfile } from './base-profile.schema';

export type FamilyProfileDocument = FamilyProfile & Document;

@Schema({
  timestamps: true,
  collection: 'familyprofiles',
  toJSON: {
    transform: (doc, ret) => {
      (ret as any).id = (ret as any)._id;
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
})
export class FamilyProfile extends BaseProfile {
  // Family specific fields
  @Prop({ required: true, trim: true })
  familyName: string; // "The Smith Family"

  @Prop([
    {
      type: {
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['parent', 'child', 'guardian'], required: true },
        permissions: [
          {
            type: String,
            enum: ['view_transactions', 'create_transactions', 'approve_transactions', 'manage_budgets', 'view_reports']
          }
        ],
        allowanceAmount: { type: Number, default: 0 }, // For children
        spendingLimit: { type: Number, default: 0 }, // Daily/weekly limit for children
        joinedAt: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true }
      }
    }
  ])
  members: {
    userId: Types.ObjectId;
    role: 'parent' | 'child' | 'guardian';
    permissions: ('view_transactions' | 'create_transactions' | 'approve_transactions' | 'manage_budgets' | 'view_reports')[];
    allowanceAmount: number;
    spendingLimit: number;
    joinedAt: Date;
    isActive: boolean;
  }[];

  // Family financial settings
  @Prop({
    type: {
      requireParentalApproval: { type: Boolean, default: true },
      approvalThreshold: { type: Number, default: 50 },
      allowChildrenToViewReports: { type: Boolean, default: false },
      allowChildrenToCreateBudgets: { type: Boolean, default: false },
      enableAllowanceTracking: { type: Boolean, default: true },
      enableSpendingLimits: { type: Boolean, default: true },
      childCategories: [{ type: String }], // Categories children can use
      parentOnlyCategories: [{ type: String }] // Categories only parents can access
    },
    default: {}
  })
  familySettings: {
    requireParentalApproval: boolean;
    approvalThreshold: number;
    allowChildrenToViewReports: boolean;
    allowChildrenToCreateBudgets: boolean;
    enableAllowanceTracking: boolean;
    enableSpendingLimits: boolean;
    childCategories: string[];
    parentOnlyCategories: string[];
  };

  // Family financial goals and savings
  @Prop([
    {
      type: {
        name: { type: String, required: true },
        targetAmount: { type: Number, required: true },
        currentAmount: { type: Number, default: 0 },
        targetDate: { type: Date },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        isCompleted: { type: Boolean, default: false },
        assignedTo: [{ type: Types.ObjectId, ref: 'User' }], // Which family members contribute
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
  familyGoals: {
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: Date;
    priority: 'low' | 'medium' | 'high';
    isCompleted: boolean;
    assignedTo: Types.ObjectId[];
    contributions: {
      userId: Types.ObjectId;
      amount: number;
      date: Date;
    }[];
  }[];

  // Allowance and chore tracking
  @Prop([
    {
      type: {
        childId: { type: Types.ObjectId, ref: 'User', required: true },
        amount: { type: Number, required: true },
        frequency: { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'weekly' },
        nextPaymentDate: { type: Date },
        isActive: { type: Boolean, default: true },
        conditions: [{ type: String }] // Chores or conditions to meet
      }
    }
  ])
  allowances: {
    childId: Types.ObjectId;
    amount: number;
    frequency: 'weekly' | 'biweekly' | 'monthly';
    nextPaymentDate?: Date;
    isActive: boolean;
    conditions: string[];
  }[];

  // Family financial summary
  @Prop({
    type: {
      totalFamilyTransactions: { type: Number, default: 0 },
      totalAllowancesPaid: { type: Number, default: 0 },
      totalSavings: { type: Number, default: 0 },
      lastCalculatedAt: { type: Date, default: Date.now }
    },
    default: {}
  })
  financialSummary: {
    totalFamilyTransactions: number;
    totalAllowancesPaid: number;
    totalSavings: number;
    lastCalculatedAt: Date;
  };
}

export const FamilyProfileSchema = SchemaFactory.createForClass(FamilyProfile);

// Indexes for FamilyProfile
FamilyProfileSchema.index({ userId: 1, status: 1 }, { name: 'user_status_idx' });
FamilyProfileSchema.index({ 'members.userId': 1, status: 1 }, { name: 'members_status_idx' });
FamilyProfileSchema.index({ familyName: 1 }, { name: 'family_name_idx' });
FamilyProfileSchema.index({ 'allowances.childId': 1, 'allowances.isActive': 1 }, { name: 'allowances_active_idx' });
