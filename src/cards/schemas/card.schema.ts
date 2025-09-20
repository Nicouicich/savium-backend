import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CardBrand, CardType, CardStatus } from '@common/constants/card-types';

export type CardDocument = Card &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema()
export class EncryptedData {
  @Prop({ required: true })
  encrypted: string;

  @Prop({ required: true })
  iv: string;

  @Prop({ required: true })
  authTag: string;
}

@Schema({ timestamps: true })
export class Card {
  @Prop({ type: String, required: true, index: true })
  userId: string; // User UUID

  @Prop({ type: Types.ObjectId, ref: 'Profile', required: true, index: true })
  profileId: Types.ObjectId;

  // Card Identification (PCI Compliant)
  @Prop({ required: true, trim: true, maxlength: 50 })
  displayName: string;

  @Prop({ type: EncryptedData })
  lastFourDigits?: EncryptedData; // Encrypted last 4 digits

  @Prop({ type: String, enum: CardBrand })
  cardBrand?: CardBrand;

  @Prop({ type: String, enum: CardType, required: true })
  cardType: CardType;

  // Card Metadata
  @Prop({ trim: true, maxlength: 100 })
  issuerBank?: string;

  @Prop({
    trim: true,
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/ // Hex color validation
  })
  color?: string;

  @Prop({ trim: true, maxlength: 50 })
  icon?: string;

  // Financial Information
  @Prop({ type: Number, min: 0 })
  creditLimit?: number;

  @Prop({ type: Number, min: 1, max: 31 })
  billingCycleDay?: number;

  @Prop({ type: Number, min: 0, max: 100 })
  interestRate?: number; // Percentage

  @Prop({ type: Number, min: 0 })
  annualFee?: number;

  // Status & Tracking
  @Prop({ type: Number, min: 1, max: 12 })
  expiryMonth?: number;

  @Prop({ type: Number, min: new Date().getFullYear() })
  expiryYear?: number;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ type: String, enum: CardStatus, default: CardStatus.ACTIVE })
  status: CardStatus;

  // Soft Delete
  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: String, index: true })
  deletedBy?: string; // User UUID
}

export const CardSchema = SchemaFactory.createForClass(Card);

// Ensure only one default card per user/profile combination
CardSchema.index(
  { userId: 1, profileId: 1, isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true, deletedAt: { $exists: false } }
  }
);

// Ensure unique display name per user/profile combination
CardSchema.index(
  { userId: 1, profileId: 1, displayName: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } }
  }
);

// Performance indexes
CardSchema.index({ userId: 1, profileId: 1, status: 1 });
CardSchema.index({ profileId: 1, deletedAt: 1 });
CardSchema.index({ userId: 1, status: 1, deletedAt: 1 });
CardSchema.index({ cardType: 1, status: 1 });
CardSchema.index({ expiryYear: 1, expiryMonth: 1, status: 1 });
