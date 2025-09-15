import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReferralSettingsDocument = ReferralSettings & Document;

export enum PrivacyMode {
  PUBLIC = 'public',
  FRIENDS_ONLY = 'friends_only',
  PRIVATE = 'private'
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
export class ReferralSettings {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  })
  userId: Types.ObjectId;

  @Prop({
    type: Boolean,
    default: true
  })
  notificationsEnabled: boolean;

  @Prop({
    type: Boolean,
    default: true
  })
  emailNotifications: boolean;

  @Prop({
    type: Boolean,
    default: true
  })
  pushNotifications: boolean;

  @Prop({
    type: Boolean,
    default: false
  })
  smsNotifications: boolean;

  @Prop({
    type: String,
    enum: PrivacyMode,
    default: PrivacyMode.PUBLIC
  })
  privacyMode: PrivacyMode;

  @Prop({
    type: Boolean,
    default: true
  })
  allowPublicSharing: boolean;

  @Prop({
    type: Boolean,
    default: true
  })
  showInLeaderboards: boolean;

  @Prop({
    type: Boolean,
    default: true
  })
  autoGenerateShareLinks: boolean;

  // Custom referral code preferences
  @Prop({
    type: String,
    maxlength: 50
  })
  customReferralCode?: string;

  @Prop({
    type: Boolean,
    default: false
  })
  useCustomCode: boolean;

  // Reward preferences
  @Prop({
    type: {
      preferredRedemptionMethod: {
        type: String,
        enum: ['bank_transfer', 'paypal', 'gift_card', 'account_credit', 'crypto'],
        default: 'account_credit'
      },
      autoRedeemThreshold: {
        type: Number,
        min: 0,
        default: 0
      },
      autoRedeemEnabled: {
        type: Boolean,
        default: false
      }
    },
    default: {}
  })
  rewardPreferences: {
    preferredRedemptionMethod: string;
    autoRedeemThreshold: number;
    autoRedeemEnabled: boolean;
  };

  // Marketing and promotion settings
  @Prop({
    type: Boolean,
    default: true
  })
  allowMarketingEmails: boolean;

  @Prop({
    type: Boolean,
    default: false
  })
  allowThirdPartyPromotions: boolean;

  // Analytics and tracking
  @Prop({
    type: Boolean,
    default: true
  })
  allowAnalyticsTracking: boolean;

  @Prop({
    type: Boolean,
    default: true
  })
  shareSuccessStories: boolean;

  // Audit fields
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const ReferralSettingsSchema = SchemaFactory.createForClass(ReferralSettings);

// Indexes for efficient queries
ReferralSettingsSchema.index(
  { userId: 1 },
  {
    name: 'user_settings_idx',
    background: true,
    unique: true
  }
);

ReferralSettingsSchema.index(
  { customReferralCode: 1 },
  {
    name: 'custom_code_idx',
    background: true,
    unique: true,
    sparse: true
  }
);

ReferralSettingsSchema.index(
  { privacyMode: 1, showInLeaderboards: 1 },
  {
    name: 'privacy_leaderboard_idx',
    background: true
  }
);

ReferralSettingsSchema.index(
  { 'rewardPreferences.autoRedeemEnabled': 1, 'rewardPreferences.autoRedeemThreshold': 1 },
  {
    name: 'auto_redeem_idx',
    background: true,
    sparse: true
  }
);

// Virtual to populate user details
ReferralSettingsSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
ReferralSettingsSchema.set('toJSON', { virtuals: true });
ReferralSettingsSchema.set('toObject', { virtuals: true });
