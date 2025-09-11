import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Document, Types} from 'mongoose';

export type UserAuthDocument = UserAuth & Document;

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
export class UserAuth {
  @Prop({type: Types.ObjectId, ref: 'User', required: true, unique: true})
  userId: Types.ObjectId;

  // Authentication tokens with TTL
  @Prop([
    {
      token: {type: String, required: true},
      expiresAt: {type: Date, required: true, expires: 0}, // MongoDB TTL index
      createdAt: {type: Date, default: Date.now},
      userAgent: {type: String},
      ipAddress: {type: String},
      deviceId: {type: String}
    }
  ])
  refreshTokens?: Array<{
    token: string;
    expiresAt: Date;
    createdAt: Date;
    userAgent?: string;
    ipAddress?: string;
    deviceId?: string;
  }>;

  // Password reset functionality
  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  // Email verification
  @Prop()
  emailVerificationToken?: string;

  @Prop({default: false})
  isEmailVerified: boolean;

  // Security metadata
  @Prop({default: Date.now})
  lastLoginAt?: Date;

  @Prop([
    {
      deviceId: {type: String, required: true},
      deviceName: String,
      userAgent: String,
      ipAddress: String,
      lastUsedAt: {type: Date, default: Date.now},
      isActive: {type: Boolean, default: true}
    }
  ])
  activeSessions?: {
    deviceId: string;
    deviceName?: string;
    userAgent?: string;
    ipAddress?: string;
    lastUsedAt: Date;
    isActive: boolean;
  }[];

  // Failed login attempts tracking
  @Prop({default: 0})
  failedLoginAttempts: number;

  @Prop()
  lockedUntil?: Date;

  // Two-factor authentication
  @Prop({default: false})
  twoFactorEnabled: boolean;

  @Prop()
  twoFactorSecret?: string;

  @Prop([String])
  backupCodes?: string[];
}

export const UserAuthSchema = SchemaFactory.createForClass(UserAuth);

// Note: Indexes are managed centrally through DatabasePerformanceService
// to avoid duplicates and conflicts. See src/database/indexes.ts
