import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from '@common/constants/user-roles';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      (ret as any).id = (ret as any)._id;
      delete (ret as any)._id;
      delete (ret as any).__v;
      delete (ret as any).password; // Never expose password
      return ret;
    }
  }
})
export class User {
  // Core identity information
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  })
  email: string;

  @Prop({ required: false, select: false }) // Exclude from queries by default, not required for OAuth users
  password?: string;

  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.USER
  })
  role: UserRole;

  @Prop([{ type: String }])
  permissions?: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop([
    {
      token: { type: String, required: true },
      expiresAt: { type: Date, required: true, expires: 0 }, // MongoDB TTL index
      createdAt: { type: Date, default: Date.now },
      userAgent: { type: String },
      ipAddress: { type: String }
    }
  ])
  refreshTokens: Array<{
    token: string;
    expiresAt: Date;
    createdAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }>;

  // OAuth provider information
  @Prop()
  oauthProvider?: string; // 'google', 'apple', etc.

  @Prop()
  oauthProviderId?: string; // Provider's user ID

  // Multi-profile system
  @Prop({ type: Types.ObjectId, ref: 'UserProfile' })
  activeProfileId?: Types.ObjectId; // Currently active profile

  @Prop([{ type: Types.ObjectId, ref: 'UserProfile' }])
  profiles: Types.ObjectId[]; // All user profiles

  // Global user preferences (applies to all profiles)
  @Prop({
    type: {
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        marketing: { type: Boolean, default: false }
      },
      privacy: {
        dataCollection: { type: Boolean, default: true },
        analytics: { type: Boolean, default: true },
        thirdPartySharing: { type: Boolean, default: false }
      },
      display: {
        currency: { type: String, default: 'USD' },
        language: { type: String, default: 'en' },
        theme: {
          type: String,
          enum: ['light', 'dark', 'auto'],
          default: 'light'
        },
        dateFormat: { type: String, default: 'MM/DD/YYYY' },
        timeFormat: { type: String, default: '12h' }
      },
      security: {
        twoFactorEnabled: { type: Boolean, default: false },
        sessionTimeout: { type: Number, default: 30 }, // minutes
        requirePasswordChange: { type: Boolean, default: false }
      }
    },
    default: {}
  })
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
      marketing: boolean;
    };
    privacy: {
      dataCollection: boolean;
      analytics: boolean;
      thirdPartySharing: boolean;
    };
    display: {
      currency: string;
      language: string;
      theme: 'light' | 'dark' | 'auto';
      dateFormat: string;
      timeFormat: string;
    };
    security: {
      twoFactorEnabled: boolean;
      sessionTimeout: number;
      requirePasswordChange: boolean;
    };
  };

  // Account relationships (unchanged)
  @Prop([{ type: Types.ObjectId, ref: 'Account' }])
  accounts: Types.ObjectId[];

  // Compliance and legal
  @Prop({ default: Date.now })
  termsAcceptedAt: Date;

  @Prop()
  privacyPolicyAcceptedAt?: Date;

  @Prop()
  marketingConsentAt?: Date;

  // Status tracking
  @Prop({
    type: String,
    enum: ['active', 'suspended', 'deactivated', 'pending_verification', 'pending_deletion'],
    default: 'pending_verification'
  })
  status: 'active' | 'suspended' | 'deactivated' | 'pending_verification' | 'pending_deletion';

  // Metadata for extensibility
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  // Audit fields
  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Note: Indexes are managed centrally through DatabasePerformanceService
// to avoid duplicates and conflicts. See src/database/indexes.ts

// Critical compound indexes for performance (from MEJORAS.md DB-002)
// Authentication and session management queries
UserSchema.index(
  { email: 1, isActive: 1 },
  {
    name: 'email_active_idx',
    background: true
  }
);

// User lookup with status filtering
UserSchema.index(
  { status: 1, isActive: 1 },
  {
    name: 'status_active_idx',
    background: true
  }
);

// OAuth provider queries
UserSchema.index(
  { oauthProvider: 1, oauthProviderId: 1 },
  {
    name: 'oauth_provider_idx',
    background: true,
    sparse: true
  }
);

// Profile-based queries
UserSchema.index(
  { activeProfileId: 1, isActive: 1 },
  {
    name: 'active_profile_user_idx',
    background: true,
    sparse: true
  }
);

// Account relationship queries
UserSchema.index(
  { accounts: 1, isActive: 1 },
  {
    name: 'accounts_active_idx',
    background: true
  }
);

// Role-based queries with status
UserSchema.index(
  { role: 1, status: 1, isActive: 1 },
  {
    name: 'role_status_active_idx',
    background: true
  }
);

// Email verification and account status queries
UserSchema.index(
  { isEmailVerified: 1, status: 1 },
  {
    name: 'email_verified_status_idx',
    background: true
  }
);

// Refresh token management (TTL handled by MongoDB)
UserSchema.index(
  { 'refreshTokens.token': 1 },
  {
    name: 'refresh_tokens_idx',
    background: true,
    sparse: true
  }
);

// User creation and status tracking
UserSchema.index(
  { createdAt: -1, status: 1 },
  {
    name: 'created_status_idx',
    background: true
  }
);

// Security settings queries
UserSchema.index(
  { 'preferences.security.twoFactorEnabled': 1, isActive: 1 },
  {
    name: 'two_factor_active_idx',
    background: true,
    sparse: true
  }
);

// Virtual for full name
UserSchema.virtual('fullName').get(function (this: User) {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual to populate active profile
UserSchema.virtual('activeProfile', {
  ref: 'UserProfile',
  localField: 'activeProfileId',
  foreignField: '_id',
  justOne: true
});

// Virtual to populate all profiles
UserSchema.virtual('userProfiles', {
  ref: 'UserProfile',
  localField: 'profiles',
  foreignField: '_id'
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

// Pre-save middleware for password hashing will be handled in the service
