// Branded types for enhanced type safety and security
export type Brand<T, K> = T & { __brand: K };

// User-related branded types
export type UserId = Brand<string, 'UserId'>;
export type UserEmail = Brand<string, 'UserEmail'>;

// Account-related branded types
export type AccountId = Brand<string, 'AccountId'>;
export type AccountName = Brand<string, 'AccountName'>;

// Financial data branded types
export type MonetaryAmount = Brand<number, 'MonetaryAmount'>;
export type CurrencyCode = Brand<string, 'CurrencyCode'>;

// Expense-related branded types
export type ExpenseId = Brand<string, 'ExpenseId'>;
export type CategoryId = Brand<string, 'CategoryId'>;

// Budget-related branded types
export type BudgetId = Brand<string, 'BudgetId'>;

// Authentication branded types
export type JWT = Brand<string, 'JWT'>;
export type RefreshToken = Brand<string, 'RefreshToken'>;
export type InvitationToken = Brand<string, 'InvitationToken'>;

// Security sensitive branded types
export type PasswordHash = Brand<string, 'PasswordHash'>;
export type PlainTextPassword = Brand<string, 'PlainTextPassword'>;

// API Keys and secrets
export type ApiKey = Brand<string, 'ApiKey'>;
export type WebhookSecret = Brand<string, 'WebhookSecret'>;

// Utility functions for creating branded types
export const createUserId = (id: string): UserId => id as UserId;
export const createUserEmail = (email: string): UserEmail => email as UserEmail;
export const createAccountId = (id: string): AccountId => id as AccountId;
export const createAccountName = (name: string): AccountName => name as AccountName;
export const createMonetaryAmount = (amount: number): MonetaryAmount => amount as MonetaryAmount;
export const createCurrencyCode = (code: string): CurrencyCode => code as CurrencyCode;
export const createExpenseId = (id: string): ExpenseId => id as ExpenseId;
export const createCategoryId = (id: string): CategoryId => id as CategoryId;
export const createBudgetId = (id: string): BudgetId => id as BudgetId;
export const createJWT = (token: string): JWT => token as JWT;
export const createRefreshToken = (token: string): RefreshToken => token as RefreshToken;
export const createInvitationToken = (token: string): InvitationToken => token as InvitationToken;
export const createPasswordHash = (hash: string): PasswordHash => hash as PasswordHash;
export const createPlainTextPassword = (password: string): PlainTextPassword => password as PlainTextPassword;
export const createApiKey = (key: string): ApiKey => key as ApiKey;
export const createWebhookSecret = (secret: string): WebhookSecret => secret as WebhookSecret;

// Validation utilities
export const isValidMonetaryAmount = (amount: number): amount is MonetaryAmount => {
  return Number.isFinite(amount) && amount >= 0 && amount <= 999999999.99; // Max 999M with 2 decimal places
};

export const isValidCurrencyCode = (code: string): code is CurrencyCode => {
  return /^[A-Z]{3}$/.test(code); // ISO 4217 format
};

export const isValidEmail = (email: string): email is UserEmail => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): password is PlainTextPassword => {
  // At least 8 characters, contains uppercase, lowercase, number, and special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};
