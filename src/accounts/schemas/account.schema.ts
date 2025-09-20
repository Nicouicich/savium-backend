import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AccountStatus, AccountType } from '@common/constants/account-types';
import { AccountRole } from '@common/constants/user-roles';
import { CoupleFinancialModel } from '@common/constants/couple-types';

export type AccountDocument = Account & Document;

@Schema()
export class PrivacySettings {
  @Prop({ default: 'all_members' })
  transactionVisibility: string;

  @Prop({ default: 'all_members' })
  reportVisibility: string;

  @Prop({ default: 'all_members' })
  budgetVisibility: string;

  @Prop({ default: false })
  allowPrivateTransactions?: boolean;

  @Prop({ type: Number, default: 0 })
  childTransactionLimit?: number;

  @Prop({ default: false })
  requireApproval?: boolean;

  @Prop({ type: Number, default: 0 })
  approvalThreshold?: number;
}

@Schema()
export class AccountMember {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: AccountRole, required: true })
  role: AccountRole;

  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  transactionLimit?: number;

  @Prop({ type: [String], default: [] })
  permissions: string[];
}

@Schema()
export class AccountInvitation {
  @Prop({ required: true })
  email: string;

  @Prop({ type: String, enum: AccountRole, required: true })
  role: AccountRole;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedBy: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  invitedAt: Date;

  @Prop({ type: Date })
  expiresAt: Date;

  @Prop({ default: 'pending' })
  status: string;

  @Prop()
  token: string;

  @Prop({ type: Number, default: 0 })
  transactionLimit?: number;
}

@Schema({ timestamps: true })
export class Account {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: AccountType, required: true })
  type: AccountType;

  @Prop({ type: String, enum: AccountStatus, default: AccountStatus.ACTIVE })
  status: AccountStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner: Types.ObjectId;

  @Prop({ type: [AccountMember], default: [] })
  members: AccountMember[];

  @Prop({ type: [AccountInvitation], default: [] })
  pendingInvitations: AccountInvitation[];

  @Prop({ type: PrivacySettings })
  privacySettings: PrivacySettings;

  @Prop({ type: String, default: 'USD' })
  currency: string;

  @Prop({ type: String })
  timezone: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Object, default: {} })
  preferences: Record<string, any>;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  lastActivityAt: Date;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  // Couple-specific settings (only for COUPLE account type)
  @Prop({
    type: String,
    enum: Object.values(CoupleFinancialModel),
    sparse: true
  })
  coupleFinancialModel?: CoupleFinancialModel;

  @Prop({ type: Boolean, sparse: true })
  bothPartnersAccepted?: boolean;

  @Prop({ type: Date, sparse: true })
  coupleSettingsLastUpdated?: Date;

  // Reference to detailed couple settings
  @Prop({ type: Types.ObjectId, ref: 'CoupleSettings', sparse: true })
  coupleSettingsId?: Types.ObjectId;
}

export const AccountSchema = SchemaFactory.createForClass(Account);

// Note: Indexes are managed centrally through DatabasePerformanceService
// to avoid duplicates and conflicts. See src/database/indexes.ts

// Critical compound indexes for performance (from MEJORAS.md DB-002)
// Account ownership and status queries
AccountSchema.index(
  { owner: 1, status: 1, isDeleted: 1 },
  {
    name: 'owner_status_deleted_idx',
    background: true
  }
);

// Account type and status filtering
AccountSchema.index(
  { type: 1, status: 1 },
  {
    name: 'type_status_idx',
    background: true
  }
);

// Member-based queries
AccountSchema.index(
  { 'members.userId': 1, status: 1 },
  {
    name: 'member_user_status_idx',
    background: true
  }
);

// Active member queries with role filtering
AccountSchema.index(
  { 'members.userId': 1, 'members.isActive': 1, 'members.role': 1 },
  {
    name: 'member_active_role_idx',
    background: true
  }
);

// Account activity tracking
AccountSchema.index(
  { lastActivityAt: -1, status: 1 },
  {
    name: 'activity_status_idx',
    background: true
  }
);

// Owner with account type queries
AccountSchema.index(
  { owner: 1, type: 1, isDeleted: 1 },
  {
    name: 'owner_type_deleted_idx',
    background: true
  }
);

// Currency-based filtering for multi-currency support
AccountSchema.index(
  { currency: 1, status: 1 },
  {
    name: 'currency_status_idx',
    background: true
  }
);

// Existing invitation indexes
AccountSchema.index({ 'pendingInvitations.email': 1 });
AccountSchema.index({ 'pendingInvitations.token': 1 });

// Enhanced invitation queries
AccountSchema.index(
  { 'pendingInvitations.status': 1, 'pendingInvitations.expiresAt': 1 },
  {
    name: 'invitation_status_expires_idx',
    background: true,
    sparse: true
  }
);

// Couple-specific indexes
AccountSchema.index(
  { type: 1, coupleFinancialModel: 1, bothPartnersAccepted: 1 },
  {
    name: 'couple_type_model_accepted_idx',
    background: true,
    sparse: true
  }
);

AccountSchema.index(
  { coupleSettingsId: 1 },
  {
    name: 'couple_settings_ref_idx',
    background: true,
    sparse: true
  }
);
