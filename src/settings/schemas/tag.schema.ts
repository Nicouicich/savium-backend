import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TagDocument = Tag & Document;

@Schema({ timestamps: true })
export class Tag {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  color: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Profile' })
  profileId?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  usageCount: number;

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const TagSchema = SchemaFactory.createForClass(Tag);

// Compound indexes for performance
// User-specific tag queries with active filtering
TagSchema.index(
  { userId: 1, isActive: 1, isDeleted: 1 },
  {
    name: 'user_active_deleted_idx',
    background: true
  }
);

// Profile-specific tag queries
TagSchema.index(
  { profileId: 1, isActive: 1, isDeleted: 1 },
  {
    name: 'profile_active_deleted_idx',
    background: true,
    sparse: true
  }
);

// Unique constraint for tag names per user
TagSchema.index(
  { name: 1, userId: 1 },
  {
    unique: true,
    name: 'name_user_unique_idx'
  }
);

// Usage-based queries for analytics
TagSchema.index(
  { usageCount: -1, lastUsedAt: -1, isActive: 1 },
  {
    name: 'usage_analytics_idx',
    background: true
  }
);

// Text search index for tag names and descriptions
TagSchema.index(
  {
    name: 'text',
    description: 'text'
  },
  {
    name: 'tag_text_search',
    weights: { name: 10, description: 1 }
  }
);
