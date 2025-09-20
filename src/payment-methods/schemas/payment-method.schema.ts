import { PaymentMethodType } from '@common/constants/card-types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentMethodDocument =
  & PaymentMethod
  & Document
  & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true })
export class PaymentMethod {
  @Prop({ required: true, trim: true, maxlength: 50 })
  name: string;

  @Prop({ required: true, unique: true, uppercase: true, maxlength: 30 })
  code: string;

  @Prop({ type: String, enum: PaymentMethodType, required: true })
  type: PaymentMethodType;

  @Prop({ required: true, default: false })
  requiresCard: boolean;

  @Prop({ trim: true, maxlength: 10 })
  icon?: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);

// Indexes
PaymentMethodSchema.index({ code: 1 }, { unique: true });
PaymentMethodSchema.index({ type: 1, isActive: 1 });
PaymentMethodSchema.index({ sortOrder: 1, isActive: 1 });
