import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserProfileDocument = UserProfile & Document;

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
export class UserProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string; // Can be different from legal name for privacy

  @Prop({ trim: true })
  displayName?: string;

  @Prop()
  avatar?: string;

  @Prop()
  bio?: string;

  @Prop()
  phone?: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop()
  timezone?: string;

  @Prop()
  locale?: string;

  // Professional/Business information
  @Prop()
  profession?: string;

  @Prop()
  company?: string;

  @Prop()
  website?: string;

  // Social media links
  @Prop({
    type: {
      linkedin: String,
      twitter: String,
      github: String,
      instagram: String
    }
  })
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    instagram?: string;
  };

  // Profile status
  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDefault: boolean; // One profile should be marked as default

  // Profile type for different contexts
  @Prop({
    type: String,
    enum: ['personal', 'professional', 'business', 'family'],
    default: 'personal'
  })
  profileType: 'personal' | 'professional' | 'business' | 'family';

  // Privacy settings specific to this profile
  @Prop({
    type: {
      visibility: {
        type: String,
        enum: ['public', 'private', 'connections'],
        default: 'private'
      },
      showContactInfo: { type: Boolean, default: false },
      showSocialLinks: { type: Boolean, default: false },
      indexInSearchEngines: { type: Boolean, default: false }
    },
    default: {}
  })
  privacy: {
    visibility: 'public' | 'private' | 'connections';
    showContactInfo: boolean;
    showSocialLinks: boolean;
    indexInSearchEngines: boolean;
  };

  // Account associations for this profile
  @Prop([{ type: Types.ObjectId, ref: 'Account' }])
  associatedAccounts: Types.ObjectId[];

  // Metadata
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);

// Note: Indexes are managed centrally through DatabasePerformanceService
// to avoid duplicates and conflicts. See src/database/indexes.ts

// Critical compound indexes for performance (from MEJORAS.md DB-002)
// User-profile relationship queries
UserProfileSchema.index(
  { userId: 1, isActive: 1 },
  {
    name: 'user_active_idx',
    background: true
  }
);

// Default profile queries
UserProfileSchema.index(
  { userId: 1, isDefault: 1 },
  {
    name: 'user_default_idx',
    background: true
  }
);

// Profile type filtering
UserProfileSchema.index(
  { userId: 1, profileType: 1, isActive: 1 },
  {
    name: 'user_type_active_idx',
    background: true
  }
);

// Account association queries
UserProfileSchema.index(
  { associatedAccounts: 1, isActive: 1 },
  {
    name: 'accounts_active_idx',
    background: true
  }
);

// Privacy visibility queries
UserProfileSchema.index(
  { 'privacy.visibility': 1, isActive: 1 },
  {
    name: 'privacy_visibility_active_idx',
    background: true
  }
);

// Text search for profile names and display names
UserProfileSchema.index(
  {
    name: 'text',
    displayName: 'text',
    bio: 'text',
    company: 'text'
  },
  {
    name: 'profile_text_search',
    weights: { name: 10, displayName: 8, company: 5, bio: 1 }
  }
);
