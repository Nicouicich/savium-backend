import { BalanceUpdateSource } from '@common/constants/card-types';
import { Currency } from '@common/constants/transaction-categories';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CardBalanceDocument =
  & CardBalance
  & Document
  & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true })
export class CardBalance {
  @Prop({ type: Types.ObjectId, ref: 'Card', required: true, index: true })
  cardId: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  userId: string; // User UUID

  // Balance Information
  @Prop({ required: true, default: 0 })
  currentBalance: number;

  @Prop({ type: Number, min: 0 })
  availableCredit?: number; // For credit cards

  @Prop({ type: Number, min: 0 })
  minimumPayment?: number;

  @Prop({ type: Date })
  paymentDueDate?: Date;

  @Prop({ type: String, enum: Currency, default: Currency.USD })
  currency: Currency;

  // Statement Period
  @Prop({ type: Date })
  statementStartDate?: Date;

  @Prop({ type: Date })
  statementEndDate?: Date;

  @Prop({ type: Number })
  statementBalance?: number;

  // Tracking
  @Prop({ type: Date, default: Date.now })
  lastUpdated: Date;

  @Prop({ default: false })
  isAutomaticUpdate: boolean;

  @Prop({ type: String, enum: BalanceUpdateSource, default: BalanceUpdateSource.MANUAL })
  updateSource: BalanceUpdateSource;

  // Additional metadata
  @Prop({ type: Number, min: 0, max: 100 })
  utilizationRate?: number; // Percentage of credit limit used

  @Prop({ default: false })
  isOverdue: boolean;

  @Prop({ type: Number, min: 0 })
  overdueAmount?: number;

  @Prop({ type: Number, min: 0 })
  lateFees?: number;

  @Prop({ type: Number, min: 0 })
  interestCharges?: number;
}

export const CardBalanceSchema = SchemaFactory.createForClass(CardBalance);

// Ensure one balance record per card (latest)
CardBalanceSchema.index({ cardId: 1 }, { unique: true });

// Performance indexes
CardBalanceSchema.index({ cardId: 1, statementEndDate: -1 });
CardBalanceSchema.index({ userId: 1, paymentDueDate: 1 });
CardBalanceSchema.index({ userId: 1, isOverdue: 1, paymentDueDate: 1 });
CardBalanceSchema.index({ updateSource: 1, lastUpdated: -1 });

// Compound index for balance queries
CardBalanceSchema.index({ userId: 1, cardId: 1, lastUpdated: -1 });
