import {Prop, Schema, SchemaFactory} from '@nestjs/mongoose';
import {Document, Types} from 'mongoose';
import {ExpenseCategory} from '@common/constants/expense-categories';

export type CategoryDocument = Category & Document;

@Schema()
export class Subcategory {
  @Prop({required: true})
  name: string;

  @Prop({required: true})
  displayName: string;

  @Prop()
  description?: string;

  @Prop({default: true})
  isActive: boolean;
}

@Schema({timestamps: true})
export class Category {
  @Prop({required: true, trim: true})
  name: string;

  @Prop({required: true, trim: true})
  displayName: string;

  @Prop({enum: ExpenseCategory})
  type?: ExpenseCategory;

  @Prop({required: true})
  icon: string;

  @Prop({required: true})
  color: string;

  @Prop()
  description?: string;

  @Prop({type: [Subcategory], default: []})
  subcategories: Subcategory[];

  @Prop({type: Types.ObjectId, ref: 'Account'})
  accountId?: Types.ObjectId;

  @Prop({type: Types.ObjectId, ref: 'User'})
  createdBy?: Types.ObjectId;

  @Prop({default: false})
  isCustom: boolean;

  @Prop({default: true})
  isActive: boolean;

  @Prop({default: true})
  isVisible: boolean;

  @Prop({type: [String], default: []})
  keywords: string[];

  @Prop({type: Object, default: {}})
  aiConfig: Record<string, any>;

  @Prop({type: Number, default: 0})
  sortOrder: number;

  @Prop({type: Object, default: {}})
  metadata: Record<string, any>;

  @Prop({default: false})
  isDeleted: boolean;

  @Prop({type: Date})
  deletedAt?: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Critical compound indexes for performance (from MEJORAS.md DB-002)
// Account-specific category queries with active filtering
CategorySchema.index(
  {accountId: 1, isActive: 1, isVisible: 1},
  {
    name: 'account_active_visible_idx',
    background: true
  }
);

// Category type filtering with active status
CategorySchema.index(
  {type: 1, isActive: 1, isVisible: 1},
  {
    name: 'type_active_visible_idx',
    background: true
  }
);

// Unique constraint for category names per account
CategorySchema.index(
  {name: 1, accountId: 1},
  {
    unique: true,
    name: 'name_account_unique_idx'
  }
);

// Keyword-based searches
CategorySchema.index(
  {keywords: 1, isActive: 1},
  {
    name: 'keywords_active_idx',
    background: true
  }
);

// Custom category queries
CategorySchema.index(
  {isCustom: 1, isActive: 1, accountId: 1},
  {
    name: 'custom_active_account_idx',
    background: true
  }
);

// Sort order with visibility filtering
CategorySchema.index(
  {sortOrder: 1, isActive: 1, isVisible: 1},
  {
    name: 'sort_active_visible_idx',
    background: true
  }
);

// Creator-based queries for custom categories
CategorySchema.index(
  {createdBy: 1, isCustom: 1, isActive: 1},
  {
    name: 'creator_custom_active_idx',
    background: true,
    sparse: true
  }
);

// Account and type combination with soft delete filtering
CategorySchema.index(
  {accountId: 1, type: 1, isDeleted: 1},
  {
    name: 'account_type_deleted_idx',
    background: true
  }
);

// Text search index for category names and descriptions
CategorySchema.index(
  {
    name: 'text',
    displayName: 'text',
    description: 'text',
    keywords: 'text'
  },
  {
    name: 'category_text_search',
    weights: {name: 10, displayName: 8, keywords: 5, description: 1}
  }
);
