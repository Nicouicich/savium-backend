// Global user roles
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

// Account-specific roles
export enum AccountRole {
  // Personal account roles
  OWNER = 'owner',

  // Couple account roles  
  PARTNER = 'partner',

  // Family account roles
  PARENT = 'parent',
  CHILD = 'child',
  GUARDIAN = 'guardian',

  // Business account roles
  BUSINESS_OWNER = 'business_owner',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
  ACCOUNTANT = 'accountant',
  VIEWER = 'viewer',
}

// Permission levels
export enum Permission {
  // Transaction permissions
  CREATE_EXPENSE = 'create_transaction',
  READ_EXPENSE = 'read_transaction',
  UPDATE_EXPENSE = 'update_transaction',
  DELETE_EXPENSE = 'delete_transaction',

  // Account permissions
  MANAGE_ACCOUNT = 'manage_account',
  INVITE_MEMBERS = 'invite_members',
  REMOVE_MEMBERS = 'remove_members',
  UPDATE_ROLES = 'update_roles',

  // Report permissions
  VIEW_REPORTS = 'view_reports',
  EXPORT_REPORTS = 'export_reports',

  // Budget permissions
  CREATE_BUDGET = 'create_budget',
  UPDATE_BUDGET = 'update_budget',
  DELETE_BUDGET = 'delete_budget',

  // Admin permissions
  MANAGE_USERS = 'manage_users',
  SYSTEM_CONFIG = 'system_config',

  // System operations
  PROCESS_RECURRING_EXPENSES = 'process_recurring_transactions',
  SYSTEM_OPERATION = 'system_operation',
}

// Role-permission mappings
export const ROLE_PERMISSIONS = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),

  [UserRole.ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.PROCESS_RECURRING_EXPENSES,
    Permission.SYSTEM_OPERATION,
  ],

  [UserRole.USER]: [
    Permission.CREATE_EXPENSE,
    Permission.READ_EXPENSE,
    Permission.UPDATE_EXPENSE,
    Permission.DELETE_EXPENSE,
    Permission.VIEW_REPORTS,
  ],

  // Account-specific role permissions
  [AccountRole.OWNER]: [
    Permission.CREATE_EXPENSE,
    Permission.READ_EXPENSE,
    Permission.UPDATE_EXPENSE,
    Permission.DELETE_EXPENSE,
    Permission.MANAGE_ACCOUNT,
    Permission.INVITE_MEMBERS,
    Permission.REMOVE_MEMBERS,
    Permission.UPDATE_ROLES,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.CREATE_BUDGET,
    Permission.UPDATE_BUDGET,
    Permission.DELETE_BUDGET,
  ],

  [AccountRole.PARTNER]: [
    Permission.CREATE_EXPENSE,
    Permission.READ_EXPENSE,
    Permission.UPDATE_EXPENSE,
    Permission.DELETE_EXPENSE,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.CREATE_BUDGET,
    Permission.UPDATE_BUDGET,
  ],

  [AccountRole.PARENT]: [
    Permission.CREATE_EXPENSE,
    Permission.READ_EXPENSE,
    Permission.UPDATE_EXPENSE,
    Permission.DELETE_EXPENSE,
    Permission.MANAGE_ACCOUNT,
    Permission.INVITE_MEMBERS,
    Permission.UPDATE_ROLES,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.CREATE_BUDGET,
    Permission.UPDATE_BUDGET,
    Permission.DELETE_BUDGET,
  ],

  [AccountRole.CHILD]: [
    Permission.CREATE_EXPENSE,
    Permission.READ_EXPENSE,
  ],

  [AccountRole.GUARDIAN]: [
    Permission.CREATE_EXPENSE,
    Permission.READ_EXPENSE,
    Permission.UPDATE_EXPENSE,
    Permission.VIEW_REPORTS,
  ],

  [AccountRole.BUSINESS_OWNER]: [
    Permission.CREATE_EXPENSE,
    Permission.READ_EXPENSE,
    Permission.UPDATE_EXPENSE,
    Permission.DELETE_EXPENSE,
    Permission.MANAGE_ACCOUNT,
    Permission.INVITE_MEMBERS,
    Permission.REMOVE_MEMBERS,
    Permission.UPDATE_ROLES,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.CREATE_BUDGET,
    Permission.UPDATE_BUDGET,
    Permission.DELETE_BUDGET,
  ],

  [AccountRole.MANAGER]: [
    Permission.CREATE_EXPENSE,
    Permission.READ_EXPENSE,
    Permission.UPDATE_EXPENSE,
    Permission.DELETE_EXPENSE,
    Permission.INVITE_MEMBERS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.CREATE_BUDGET,
    Permission.UPDATE_BUDGET,
  ],

  [AccountRole.EMPLOYEE]: [
    Permission.CREATE_EXPENSE,
    Permission.READ_EXPENSE,
    Permission.UPDATE_EXPENSE,
  ],

  [AccountRole.ACCOUNTANT]: [
    Permission.READ_EXPENSE,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.CREATE_BUDGET,
    Permission.UPDATE_BUDGET,
  ],

  [AccountRole.VIEWER]: [
    Permission.READ_EXPENSE,
    Permission.VIEW_REPORTS,
  ],
};