import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { CoupleFinancialModel, CoupleExpenseType } from '@common/constants/couple-types';

export type CoupleSettingsDocument = CoupleSettings &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema()
export class CoupleContributionSettings {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  partner1UserId: Types.ObjectId; // User ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  partner2UserId: Types.ObjectId; // User ObjectId

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  partner1ContributionPercentage: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  partner2ContributionPercentage: number;

  @Prop({ type: Number, min: 0 })
  partner1MonthlyIncome?: number;

  @Prop({ type: Number, min: 0 })
  partner2MonthlyIncome?: number;

  @Prop({ default: false })
  autoCalculateFromIncome: boolean;

  @Prop({ type: Date, default: Date.now })
  lastUpdatedAt: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  updatedBy: Types.ObjectId; // User ObjectId
}

@Schema()
export class CoupleNotificationSettings {
  @Prop({ default: true })
  expenseAdded: boolean;

  @Prop({ default: true })
  commentsAndReactions: boolean;

  @Prop({ default: true })
  giftRevealed: boolean;

  @Prop({ default: true })
  reminders: boolean;

  @Prop({ default: true })
  budgetAlerts: boolean;
}

@Schema({ timestamps: true })
export class CoupleSettings {
  @Prop({ type: Types.ObjectId, ref: 'Account', required: true, unique: true })
  accountId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(CoupleFinancialModel),
    default: CoupleFinancialModel.FIFTY_FIFTY
  })
  financialModel: CoupleFinancialModel;

  @Prop({
    type: String,
    enum: Object.values(CoupleExpenseType),
    default: CoupleExpenseType.SHARED
  })
  defaultExpenseType: CoupleExpenseType;

  @Prop({ type: CoupleContributionSettings })
  contributionSettings?: CoupleContributionSettings;

  @Prop({ default: true })
  allowComments: boolean;

  @Prop({ default: true })
  allowReactions: boolean;

  @Prop({ default: true })
  showContributionStats: boolean;

  @Prop({ default: true })
  enableCrossReminders: boolean;

  @Prop({ default: true })
  giftModeEnabled: boolean;

  @Prop({ default: true })
  sharedGoalsEnabled: boolean;

  @Prop({ type: CoupleNotificationSettings, default: {} })
  notifications: CoupleNotificationSettings;

  // Premium feature flags (calculated based on both users' subscriptions)
  @Prop({ default: false })
  hasSharedGoals: boolean;

  @Prop({ default: false })
  hasDetailedComparisons: boolean;

  @Prop({ default: false })
  hasJointEvolutionPanel: boolean;

  @Prop({ default: false })
  hasDownloadableReports: boolean;

  @Prop({ default: false })
  hasAdvancedAnalytics: boolean;

  @Prop({ default: false })
  hasUnlimitedComments: boolean;

  @Prop({ default: false })
  hasCustomCategories: boolean;

  // Invitation acceptance tracking
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  invitationAcceptedBy?: Types.ObjectId; // User ObjectId

  @Prop({ type: Date })
  invitationAcceptedAt?: Date;

  @Prop({ default: false })
  bothPartnersAccepted: boolean;

  // Settings history for audit trail
  @Prop([
    {
      setting: { type: String, required: true },
      oldValue: { type: MongooseSchema.Types.Mixed },
      newValue: { type: MongooseSchema.Types.Mixed },
      changedBy: { type: MongooseSchema.Types.ObjectId, required: true },
      changedAt: { type: Date, default: Date.now },
      reason: { type: String }
    }
  ])
  settingsHistory: Array<{
    setting: string;
    oldValue: any;
    newValue: any;
    changedBy: Types.ObjectId; // User ObjectId
    changedAt: Date;
    reason?: string;
  }>;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const CoupleSettingsSchema = SchemaFactory.createForClass(CoupleSettings);

// Indexes for performance optimization
CoupleSettingsSchema.index(
  { accountId: 1 },
  {
    name: 'couple_settings_account_idx',
    unique: true,
    background: true
  }
);

CoupleSettingsSchema.index(
  { 'contributionSettings.partner1UserId': 1, 'contributionSettings.partner2UserId': 1 },
  {
    name: 'couple_partners_idx',
    background: true,
    sparse: true
  }
);

CoupleSettingsSchema.index(
  { bothPartnersAccepted: 1, accountId: 1 },
  {
    name: 'couple_accepted_account_idx',
    background: true
  }
);

CoupleSettingsSchema.index(
  { financialModel: 1, accountId: 1 },
  {
    name: 'couple_model_account_idx',
    background: true
  }
);

// Virtual to check if advanced features are enabled
CoupleSettingsSchema.virtual('hasAdvancedFeatures').get(function (this: CoupleSettings) {
  return this.hasSharedGoals || this.hasDetailedComparisons || this.hasJointEvolutionPanel;
});

// Virtual to get partner contribution percentages as array
CoupleSettingsSchema.virtual('contributionPercentages').get(function (this: CoupleSettings) {
  if (!this.contributionSettings) return [50, 50];

  return [this.contributionSettings.partner1ContributionPercentage, this.contributionSettings.partner2ContributionPercentage];
});

// Ensure virtual fields are serialized
CoupleSettingsSchema.set('toJSON', { virtuals: true });
CoupleSettingsSchema.set('toObject', { virtuals: true });

// Pre-save middleware to validate contribution percentages
CoupleSettingsSchema.pre('save', function (next) {
  if (this.contributionSettings && this.financialModel === CoupleFinancialModel.PROPORTIONAL_INCOME) {
    const total = this.contributionSettings.partner1ContributionPercentage + this.contributionSettings.partner2ContributionPercentage;

    if (Math.abs(total - 100) > 0.01) {
      // Allow for floating point precision
      next(new Error('Contribution percentages must sum to 100%'));
      return;
    }
  }
  next();
});
