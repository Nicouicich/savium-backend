import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseProfile } from './base-profile.schema';

export type PersonalProfileDocument = PersonalProfile & Document;

@Schema()
export class PersonalProfile extends BaseProfile {
  // Personal profile specific fields
  @Prop({
    type: {
      monthlyIncomeGoal: { type: Number, default: 0 },
      monthlySavingsGoal: { type: Number, default: 0 },
      monthlyTransactionLimit: { type: Number, default: 0 },
      emergencyFundGoal: { type: Number, default: 0 }
    },
    default: {}
  })
  personalGoals: {
    monthlyIncomeGoal: number;
    monthlySavingsGoal: number;
    monthlyTransactionLimit: number;
    emergencyFundGoal: number;
  };

  @Prop({
    type: {
      enableTransactionTracking: { type: Boolean, default: true },
      enableBudgetAlerts: { type: Boolean, default: true },
      enableSavingsReminders: { type: Boolean, default: true },
      enableMonthlyReports: { type: Boolean, default: true }
    },
    default: {}
  })
  personalSettings: {
    enableTransactionTracking: boolean;
    enableBudgetAlerts: boolean;
    enableSavingsReminders: boolean;
    enableMonthlyReports: boolean;
  };

  // Personal financial data
  @Prop([
    {
      type: {
        source: { type: String, required: true }, // salary, freelance, investment, etc.
        amount: { type: Number, required: true },
        frequency: { type: String, enum: ['monthly', 'weekly', 'biweekly', 'yearly'], default: 'monthly' },
        isActive: { type: Boolean, default: true }
      }
    }
  ])
  incomeStreams: {
    source: string;
    amount: number;
    frequency: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
    isActive: boolean;
  }[];

  @Prop([
    {
      type: {
        name: { type: String, required: true },
        targetAmount: { type: Number, required: true },
        currentAmount: { type: Number, default: 0 },
        targetDate: { type: Date },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        isCompleted: { type: Boolean, default: false }
      }
    }
  ])
  savingsGoals: {
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: Date;
    priority: 'low' | 'medium' | 'high';
    isCompleted: boolean;
  }[];
}

export const PersonalProfileSchema = SchemaFactory.createForClass(PersonalProfile);

// Indexes for PersonalProfile
PersonalProfileSchema.index({ userId: 1, status: 1 }, { name: 'user_status_idx' });
PersonalProfileSchema.index({ userId: 1, lastUsedAt: -1 }, { name: 'user_activity_idx' });
PersonalProfileSchema.index({ status: 1, createdAt: -1 }, { name: 'status_created_idx' });
