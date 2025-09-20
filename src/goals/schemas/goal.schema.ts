import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Currency } from '@common/constants/transaction-categories';

export type GoalDocument = Goal & Document;

export enum GoalType {
  SAVINGS = 'savings', // Save a specific amount
  SPENDING_REDUCTION = 'spending_reduction', // Reduce spending by amount/percentage
  CATEGORY_BUDGET = 'category_budget', // Stay within category budget
  DEBT_PAYOFF = 'debt_payoff', // Pay off debt
  EMERGENCY_FUND = 'emergency_fund', // Build emergency fund
  INVESTMENT = 'investment', // Investment goal
  CUSTOM = 'custom' // Custom goal
}

export enum GoalStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  OVERDUE = 'overdue'
}

export enum GoalPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecurrenceType {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

@Schema()
export class GoalMilestone {
  @Prop({ required: true, trim: true, maxlength: 100 })
  title: string;

  @Prop({ trim: true, maxlength: 500 })
  description?: string;

  @Prop({ required: true, min: 0 })
  targetAmount: number;

  @Prop({ default: 0, min: 0 })
  currentAmount: number;

  @Prop({ type: Date, required: true })
  targetDate: Date;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ default: 1 })
  order: number;
}

@Schema()
export class GoalSettings {
  @Prop({ default: true })
  sendReminders: boolean;

  @Prop({ default: 7 })
  reminderDaysBefore: number; // Days before target date to send reminder

  @Prop({ default: true })
  trackAutomatically: boolean; // Auto-track related transactions/savings

  @Prop({ default: false })
  allowOverage: boolean; // Allow going over target amount

  @Prop({ default: true })
  showInDashboard: boolean;

  @Prop({ default: false })
  isPrivate: boolean; // Private goals in shared accounts

  @Prop({ type: [String], default: [] })
  linkedCategories: string[]; // Categories to track for this goal

  @Prop({ type: [String], default: [] })
  excludeCategories: string[]; // Categories to exclude from tracking
}

@Schema({ timestamps: true })
export class Goal {
  @Prop({ type: String, default: uuidv4, unique: true })
  id: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  title: string;

  @Prop({ trim: true, maxlength: 1000 })
  description?: string;

  @Prop({ type: String, required: true })
  profileId: string;

  @Prop({ type: String, required: true })
  createdBy: string;

  @Prop({ enum: GoalType, required: true })
  type: GoalType;

  @Prop({ enum: Currency, default: Currency.USD })
  currency: Currency;

  @Prop({ required: true, min: 0 })
  targetAmount: number;

  @Prop({ default: 0, min: 0 })
  currentAmount: number;

  @Prop({ default: 0, min: 0 })
  remainingAmount: number;

  @Prop({ type: Date, required: true })
  targetDate: Date;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ enum: GoalStatus, default: GoalStatus.ACTIVE })
  status: GoalStatus;

  @Prop({ enum: GoalPriority, default: GoalPriority.MEDIUM })
  priority: GoalPriority;

  @Prop({ enum: RecurrenceType, default: RecurrenceType.NONE })
  recurrence: RecurrenceType;

  @Prop()
  recurringAmount?: number; // Amount to save/reduce per period

  @Prop({ type: [GoalMilestone], default: [] })
  milestones: GoalMilestone[];

  @Prop({ type: GoalSettings, default: {} })
  settings: GoalSettings;

  @Prop({ type: [String], default: [] })
  participants: string[]; // Users participating in this goal

  @Prop({ type: String })
  linkedBudgetId?: string; // Link to related budget

  @Prop({ type: Object, default: {} })
  metadata: {
    source?: string; // 'manual', 'template', 'ai_suggested'
    tags?: string[];
    notes?: string;
    lastCalculated?: Date;
    initialAmount?: number; // Starting amount when goal was created
    averageProgress?: number; // Average progress per period
    estimatedCompletion?: Date; // Estimated completion based on current progress
  };

  @Prop({ default: false })
  isTemplate: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: String })
  deletedBy?: string;
}

export const GoalSchema = SchemaFactory.createForClass(Goal);

// Add virtual for id field to ensure compatibility
GoalSchema.virtual('publicId').get(function () {
  return this.id;
});

// Ensure virtual fields are serialized
GoalSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete (ret as any)._id;
    delete (ret as any).__v;
    return ret;
  }
});

// Critical compound indexes for performance (from MEJORAS.md DB-002)
// Profile-based goal queries with status filtering
GoalSchema.index(
  { profileId: 1, status: 1, isDeleted: 1 },
  {
    name: 'profile_status_deleted_idx',
    background: true
  }
);

// Goal type filtering within profiles
GoalSchema.index(
  { profileId: 1, type: 1, status: 1, isDeleted: 1 },
  {
    name: 'profile_type_status_deleted_idx',
    background: true
  }
);

// Creator-based goal queries
GoalSchema.index(
  { createdBy: 1, status: 1, isDeleted: 1 },
  {
    name: 'creator_status_deleted_idx',
    background: true
  }
);

// Overdue goal monitoring and processing
GoalSchema.index(
  { status: 1, targetDate: 1, isDeleted: 1 },
  {
    name: 'status_targetdate_deleted_idx',
    background: true
  }
);

// Participant-based goal queries
GoalSchema.index(
  { participants: 1, status: 1, isDeleted: 1 },
  {
    name: 'participants_status_deleted_idx',
    background: true
  }
);

// Template goal queries
GoalSchema.index(
  { isTemplate: 1, profileId: 1, isDeleted: 1 },
  {
    name: 'template_profile_deleted_idx',
    background: true
  }
);

// Priority-based goal filtering
GoalSchema.index(
  { profileId: 1, priority: 1, status: 1, isDeleted: 1 },
  {
    name: 'profile_priority_status_deleted_idx',
    background: true
  }
);

// Date-based goal tracking and analytics
GoalSchema.index(
  { profileId: 1, targetDate: -1, status: 1 },
  {
    name: 'profile_targetdate_status_idx',
    background: true
  }
);

// Recurrence-based goal processing
GoalSchema.index(
  { recurrence: 1, status: 1, targetDate: 1 },
  {
    name: 'recurrence_status_targetdate_idx',
    background: true
  }
);

// Currency-based filtering for multi-currency support
GoalSchema.index(
  { profileId: 1, currency: 1, status: 1 },
  {
    name: 'profile_currency_status_idx',
    background: true
  }
);

// Progress tracking queries
GoalSchema.index(
  { profileId: 1, currentAmount: -1, status: 1 },
  {
    name: 'profile_progress_status_idx',
    background: true
  }
);

// Budget integration queries
GoalSchema.index(
  { linkedBudgetId: 1, status: 1 },
  {
    name: 'budget_linked_status_idx',
    background: true,
    sparse: true
  }
);

// Text search for goal titles and descriptions
GoalSchema.index(
  {
    title: 'text',
    description: 'text'
  },
  {
    name: 'goal_text_search',
    weights: { title: 10, description: 5 }
  }
);

// Pre-save middleware to calculate remaining amount and update status
GoalSchema.pre('save', function () {
  // Calculate remaining amount
  this.remainingAmount = Math.max(0, this.targetAmount - this.currentAmount);

  // Update status based on progress and dates
  if (this.currentAmount >= this.targetAmount && this.status === GoalStatus.ACTIVE) {
    this.status = GoalStatus.COMPLETED;
  } else if (this.targetDate < new Date() && this.status === GoalStatus.ACTIVE && this.currentAmount < this.targetAmount) {
    this.status = GoalStatus.OVERDUE;
  }

  // Update milestone completion
  this.milestones.forEach(milestone => {
    if (!milestone.isCompleted && milestone.currentAmount >= milestone.targetAmount) {
      milestone.isCompleted = true;
      milestone.completedAt = new Date();
    } else if (milestone.isCompleted && milestone.currentAmount < milestone.targetAmount) {
      milestone.isCompleted = false;
      milestone.completedAt = undefined;
    }
  });

  // Update metadata
  if (!this.metadata.lastCalculated || this.isModified('currentAmount')) {
    this.metadata.lastCalculated = new Date();
  }

  // Calculate estimated completion date based on current progress
  if (this.currentAmount > 0 && this.currentAmount < this.targetAmount) {
    const daysElapsed = this.startDate
      ? Math.ceil((Date.now() - this.startDate.getTime()) / (1000 * 60 * 60 * 24))
      : Math.ceil((Date.now() - (this as any).createdAt.getTime()) / (1000 * 60 * 60 * 24));

    if (daysElapsed > 0) {
      const dailyProgress = this.currentAmount / daysElapsed;
      if (dailyProgress > 0) {
        const remainingDays = this.remainingAmount / dailyProgress;
        this.metadata.estimatedCompletion = new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000);
      }
    }
  }
});
