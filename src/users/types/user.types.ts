import { Document, Types } from 'mongoose';
import { UserRole } from '@common/constants/user-roles';

export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: UserRole;
  permissions?: string[];
  isActive: boolean;
  isEmailVerified: boolean;
  phoneNumber?: string;
  isPhoneVerified: boolean;
  phoneVerifiedAt?: Date;
  refreshTokens: Array<{
    token: string;
    expiresAt: Date;
    createdAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }>;
  oauthProvider?: string;
  oauthProviderId?: string;
  messagingIntegrations?: {
    telegram?: {
      chatId?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      connectedAt?: Date;
    };
    whatsapp?: {
      phoneNumber?: string;
      name?: string;
      connectedAt?: Date;
    };
  };
  activeProfileId?: Types.ObjectId;
  profiles: Types.ObjectId[];
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
  accounts: Types.ObjectId[];
  referralCode?: string;
  referredByUserId?: Types.ObjectId;
  referralCompletedAt?: Date;
  lastActiveAt: Date;
  activeDaysCount: number;
  termsAcceptedAt: Date;
  privacyPolicyAcceptedAt?: Date;
  marketingConsentAt?: Date;
  status: 'active' | 'suspended' | 'deactivated' | 'pending_verification' | 'pending_deletion';
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserDocumentType = IUser &
  Document & {
    _id: Types.ObjectId;
    fullName: string;
  };

export interface UserPublicInfo {
  id: string; // MongoDB ObjectId as string
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  phoneNumber?: string;
  isPhoneVerified?: boolean;
  preferences: IUser['preferences'];
  accounts: string[]; // MongoDB ObjectId strings
  status: IUser['status'];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserForJWT {
  id: string; // MongoDB ObjectId as string
  email: string;
  role: UserRole;
  isActive: boolean;
  fullName: string;
}
