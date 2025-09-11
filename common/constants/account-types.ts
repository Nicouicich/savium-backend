export enum AccountType {
  PERSONAL = 'personal',
  COUPLE = 'couple', 
  FAMILY = 'family',
  BUSINESS = 'business',
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

// Account type configurations
export const ACCOUNT_TYPE_CONFIG = {
  [AccountType.PERSONAL]: {
    maxMembers: 1,
    allowedRoles: ['owner'],
    features: [
      'expense_tracking',
      'budgets',
      'goals',
      'reports',
      'ai_categorization',
    ],
  },
  
  [AccountType.COUPLE]: {
    maxMembers: 2,
    allowedRoles: ['partner'],
    features: [
      'expense_tracking',
      'budgets',
      'goals', 
      'reports',
      'shared_expenses',
      'privacy_settings',
      'ai_categorization',
    ],
  },
  
  [AccountType.FAMILY]: {
    maxMembers: 8,
    allowedRoles: ['parent', 'child', 'guardian'],
    features: [
      'expense_tracking',
      'budgets',
      'goals',
      'reports',
      'member_management',
      'role_permissions',
      'allowances',
      'ai_categorization',
    ],
  },
  
  [AccountType.BUSINESS]: {
    maxMembers: 50, // Can be increased based on plan
    allowedRoles: ['business_owner', 'manager', 'employee', 'accountant', 'viewer'],
    features: [
      'expense_tracking',
      'budgets',
      'reports',
      'member_management', 
      'role_permissions',
      'departments',
      'approval_workflows',
      'integrations',
      'ai_categorization',
      'receipt_processing',
    ],
  },
};

// Default privacy settings by account type
export const DEFAULT_PRIVACY_SETTINGS = {
  [AccountType.PERSONAL]: {
    expenseVisibility: 'private' as const,
    reportVisibility: 'private' as const,
    budgetVisibility: 'private' as const,
  },
  
  [AccountType.COUPLE]: {
    expenseVisibility: 'members_only' as const, // Can be set to 'private'
    reportVisibility: 'members_only' as const,
    budgetVisibility: 'members_only' as const,
    allowPrivateExpenses: true,
  },
  
  [AccountType.FAMILY]: {
    expenseVisibility: 'members_only' as const,
    reportVisibility: 'members_only' as const, 
    budgetVisibility: 'members_only' as const,
    childExpenseLimit: 50, // Default limit for children
  },
  
  [AccountType.BUSINESS]: {
    expenseVisibility: 'members_only' as const,
    reportVisibility: 'members_only' as const,
    budgetVisibility: 'members_only' as const,
    requireApproval: true,
    approvalThreshold: 500, // Default approval threshold
  },
};