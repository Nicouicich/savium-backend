import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseProfile } from './base-profile.schema';

export type CompanyProfileDocument = CompanyProfile & Document;

@Schema({
  timestamps: true,
  collection: 'businessprofiles',
  toJSON: {
    transform: (doc, ret) => {
      (ret as any).id = (ret as any)._id;
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
})
export class CompanyProfile extends BaseProfile {
  // Business specific fields
  @Prop({ required: true, trim: true })
  companyName: string;

  @Prop({ trim: true })
  businessType?: string; // LLC, Corporation, Partnership, Sole Proprietorship

  @Prop({ trim: true })
  taxId?: string; // EIN, VAT number, etc.

  @Prop({ trim: true })
  industry?: string;

  @Prop({
    type: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      zipCode: { type: String }
    }
  })
  businessAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };

  // Team and access management
  @Prop([
    {
      type: {
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['owner', 'admin', 'accountant', 'employee'], required: true },
        permissions: [
          {
            type: String,
            enum: ['view_transactions', 'create_transactions', 'approve_transactions', 'manage_budgets', 'view_reports', 'manage_team', 'manage_settings']
          }
        ],
        department: { type: String },
        employeeId: { type: String },
        joinedAt: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true }
      }
    }
  ])
  team: {
    userId: Types.ObjectId;
    role: 'owner' | 'admin' | 'accountant' | 'employee';
    permissions:
      ('view_transactions' | 'create_transactions' | 'approve_transactions' | 'manage_budgets' | 'view_reports' | 'manage_team' | 'manage_settings')[];
    department?: string;
    employeeId?: string;
    joinedAt: Date;
    isActive: boolean;
  }[];

  // Business financial settings
  @Prop({
    type: {
      requireApprovalForTransactions: { type: Boolean, default: true },
      approvalThreshold: { type: Number, default: 500 },
      enableDepartmentBudgets: { type: Boolean, default: true },
      enableProjectTracking: { type: Boolean, default: true },
      fiscalYearStart: { type: String, default: '01-01' }, // MM-DD format
      enableTaxReporting: { type: Boolean, default: true },
      businessCategories: [{ type: String }],
      transactionApprovalWorkflow: [
        {
          amount: { type: Number },
          requiredRole: { type: String, enum: ['admin', 'accountant', 'owner'] }
        }
      ]
    },
    default: {}
  })
  businessSettings: {
    requireApprovalForTransactions: boolean;
    approvalThreshold: number;
    enableDepartmentBudgets: boolean;
    enableProjectTracking: boolean;
    fiscalYearStart: string;
    enableTaxReporting: boolean;
    businessCategories: string[];
    transactionApprovalWorkflow: {
      amount: number;
      requiredRole: 'admin' | 'accountant' | 'owner';
    }[];
  };

  // Business financial tracking
  @Prop([
    {
      type: {
        name: { type: String, required: true },
        code: { type: String }, // Project code
        budget: { type: Number },
        spent: { type: Number, default: 0 },
        startDate: { type: Date },
        endDate: { type: Date },
        isActive: { type: Boolean, default: true },
        assignedTo: [{ type: Types.ObjectId, ref: 'User' }]
      }
    }
  ])
  projects: {
    name: string;
    code?: string;
    budget?: number;
    spent: number;
    startDate?: Date;
    endDate?: Date;
    isActive: boolean;
    assignedTo: Types.ObjectId[];
  }[];

  @Prop([
    {
      type: {
        name: { type: String, required: true },
        budget: { type: Number, required: true },
        spent: { type: Number, default: 0 },
        head: { type: Types.ObjectId, ref: 'User' },
        members: [{ type: Types.ObjectId, ref: 'User' }],
        isActive: { type: Boolean, default: true }
      }
    }
  ])
  departments: {
    name: string;
    budget: number;
    spent: number;
    head?: Types.ObjectId;
    members: Types.ObjectId[];
    isActive: boolean;
  }[];

  // Business financial summary and reporting
  @Prop({
    type: {
      totalRevenue: { type: Number, default: 0 },
      totalTransactions: { type: Number, default: 0 },
      netProfit: { type: Number, default: 0 },
      totalBudget: { type: Number, default: 0 },
      budgetUtilization: { type: Number, default: 0 }, // Percentage
      lastCalculatedAt: { type: Date, default: Date.now },
      quarterlyReports: [
        {
          quarter: { type: String }, // Q1-2024
          revenue: { type: Number },
          transactions: { type: Number },
          profit: { type: Number },
          generatedAt: { type: Date }
        }
      ]
    },
    default: {}
  })
  financialSummary: {
    totalRevenue: number;
    totalTransactions: number;
    netProfit: number;
    totalBudget: number;
    budgetUtilization: number;
    lastCalculatedAt: Date;
    quarterlyReports: {
      quarter: string;
      revenue: number;
      transactions: number;
      profit: number;
      generatedAt: Date;
    }[];
  };

  // Compliance and legal
  @Prop({
    type: {
      lastAuditDate: { type: Date },
      nextAuditDue: { type: Date },
      taxFilingStatus: { type: String, enum: ['current', 'pending', 'overdue'], default: 'current' },
      complianceNotes: [{ type: String }]
    }
  })
  compliance?: {
    lastAuditDate?: Date;
    nextAuditDue?: Date;
    taxFilingStatus: 'current' | 'pending' | 'overdue';
    complianceNotes: string[];
  };
}

export const CompanyProfileSchema = SchemaFactory.createForClass(CompanyProfile);

// Indexes for CompanyProfile
CompanyProfileSchema.index({ userId: 1, status: 1 }, { name: 'user_status_idx' });
CompanyProfileSchema.index({ 'team.userId': 1, 'team.isActive': 1 }, { name: 'team_active_idx' });
CompanyProfileSchema.index({ companyName: 1 }, { name: 'company_name_idx' });
CompanyProfileSchema.index({ taxId: 1 }, { name: 'tax_id_idx', sparse: true });
CompanyProfileSchema.index({ industry: 1, status: 1 }, { name: 'industry_status_idx' });
