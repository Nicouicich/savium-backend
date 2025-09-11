/**
 * Database indexing strategy for optimal query performance
 * This file defines all indexes needed for the Savium application
 */

export interface IndexDefinition {
  collection: string;
  index: Record<string, 1 | -1 | 'text' | '2dsphere'>;
  options?: {
    name?: string;
    unique?: boolean;
    sparse?: boolean;
    background?: boolean;
    partialFilterExpression?: Record<string, any>;
    expireAfterSeconds?: number;
  };
}

/**
 * All database indexes for optimal performance
 */
export const DATABASE_INDEXES: IndexDefinition[] = [
  // Users collection indexes
  {
    collection: 'users',
    index: {email: 1},
    options: {
      name: 'email_unique',
      unique: true,
      background: true
    }
  },
  {
    collection: 'users',
    index: {refreshTokens: 1},
    options: {
      name: 'refresh_tokens',
      sparse: true,
      background: true
    }
  },
  {
    collection: 'users',
    index: {isActive: 1, lastLoginAt: -1},
    options: {
      name: 'active_users_by_login',
      background: true
    }
  },
  {
    collection: 'users',
    index: {createdAt: -1},
    options: {
      name: 'users_by_creation_date',
      background: true
    }
  },

  // Accounts collection indexes
  {
    collection: 'accounts',
    index: {owner: 1, type: 1},
    options: {
      name: 'accounts_by_owner_type',
      background: true
    }
  },
  {
    collection: 'accounts',
    index: {'members.userId': 1, 'members.isActive': 1},
    options: {
      name: 'active_account_members',
      background: true
    }
  },
  {
    collection: 'accounts',
    index: {status: 1, lastActivityAt: -1},
    options: {
      name: 'accounts_by_status_activity',
      background: true
    }
  },
  {
    collection: 'accounts',
    index: {'pendingInvitations.token': 1},
    options: {
      name: 'invitation_tokens',
      sparse: true,
      background: true
    }
  },
  {
    collection: 'accounts',
    index: {'pendingInvitations.email': 1, 'pendingInvitations.status': 1},
    options: {
      name: 'pending_invitations_by_email',
      sparse: true,
      background: true
    }
  },
  {
    collection: 'accounts',
    index: {name: 'text', description: 'text'},
    options: {
      name: 'accounts_text_search',
      background: true
    }
  },

  // Expenses collection indexes
  {
    collection: 'expenses',
    index: {accountId: 1, date: -1},
    options: {
      name: 'expenses_by_account_date',
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {userId: 1, isDeleted: 1},
    options: {
      name: 'expenses_by_user_deleted_status',
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {accountId: 1, isDeleted: 1, date: -1},
    options: {
      name: 'expenses_by_account_active_date',
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {userId: 1, date: -1},
    options: {
      name: 'expenses_by_user_date',
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {accountId: 1, categoryId: 1, date: -1},
    options: {
      name: 'expenses_by_account_category_date',
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {accountId: 1, amount: -1},
    options: {
      name: 'expenses_by_account_amount',
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {
      accountId: 1,
      date: -1,
      amount: -1,
      categoryId: 1
    },
    options: {
      name: 'expenses_composite_queries',
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {tags: 1},
    options: {
      name: 'expenses_by_tags',
      sparse: true,
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {description: 'text', notes: 'text'},
    options: {
      name: 'expenses_text_search',
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {createdAt: -1},
    options: {
      name: 'expenses_by_creation',
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {recurringExpenseId: 1},
    options: {
      name: 'recurring_expenses',
      sparse: true,
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {isRecurring: 1, 'recurringPattern.nextOccurrence': 1},
    options: {
      name: 'recurring_pattern_next_occurrence',
      partialFilterExpression: {isRecurring: true},
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {isSharedExpense: 1, sharedWith: 1},
    options: {
      name: 'shared_expenses',
      partialFilterExpression: {isSharedExpense: true},
      background: true
    }
  },
  {
    collection: 'expenses',
    index: {paymentMethod: 1, date: -1},
    options: {
      name: 'expenses_by_payment_method',
      sparse: true,
      background: true
    }
  },

  // Categories collection indexes
  {
    collection: 'categories',
    index: {accountId: 1, isActive: 1},
    options: {
      name: 'active_categories_by_account',
      background: true
    }
  },
  {
    collection: 'categories',
    index: {accountId: 1, parentCategory: 1},
    options: {
      name: 'categories_by_parent',
      background: true
    }
  },
  {
    collection: 'categories',
    index: {name: 'text', description: 'text'},
    options: {
      name: 'categories_text_search',
      background: true
    }
  },
  {
    collection: 'categories',
    index: {type: 1, isActive: 1},
    options: {
      name: 'categories_by_type',
      background: true
    }
  },

  // Budgets collection indexes
  {
    collection: 'budgets',
    index: {accountId: 1, period: 1, status: 1},
    options: {
      name: 'budgets_by_account_period_status',
      background: true
    }
  },
  {
    collection: 'budgets',
    index: {accountId: 1, startDate: 1, endDate: 1},
    options: {
      name: 'budgets_by_date_range',
      background: true
    }
  },
  {
    collection: 'budgets',
    index: {'categoryBudgets.categoryId': 1},
    options: {
      name: 'category_budgets',
      sparse: true,
      background: true
    }
  },
  {
    collection: 'budgets',
    index: {createdBy: 1, status: 1},
    options: {
      name: 'budgets_by_creator',
      background: true
    }
  },

  // Goals collection indexes
  {
    collection: 'goals',
    index: {accountId: 1, status: 1},
    options: {
      name: 'goals_by_account_status',
      background: true
    }
  },
  {
    collection: 'goals',
    index: {accountId: 1, targetDate: 1},
    options: {
      name: 'goals_by_target_date',
      background: true
    }
  },
  {
    collection: 'goals',
    index: {createdBy: 1, status: 1},
    options: {
      name: 'goals_by_creator',
      background: true
    }
  },

  // Billing collection indexes
  // BillingCustomer collection
  {
    collection: 'billingcustomers',
    index: {userId: 1},
    options: {
      name: 'billing_customers_by_user',
      unique: true,
      background: true
    }
  },
  {
    collection: 'billingcustomers',
    index: {stripeCustomerId: 1},
    options: {
      name: 'billing_customers_by_stripe_id',
      unique: true,
      background: true
    }
  },
  {
    collection: 'billingcustomers',
    index: {email: 1},
    options: {
      name: 'billing_customers_by_email',
      background: true
    }
  },
  {
    collection: 'billingcustomers',
    index: {status: 1},
    options: {
      name: 'billing_customers_by_status',
      background: true
    }
  },
  {
    collection: 'billingcustomers',
    index: {riskScore: -1},
    options: {
      name: 'billing_customers_by_risk_score',
      background: true
    }
  },
  {
    collection: 'billingcustomers',
    index: {activeSubscriptionId: 1},
    options: {
      name: 'billing_customers_by_subscription',
      sparse: true,
      background: true
    }
  },
  {
    collection: 'billingcustomers',
    index: {'paymentMethods.stripePaymentMethodId': 1},
    options: {
      name: 'billing_payment_methods',
      sparse: true,
      background: true
    }
  },

  // Subscription collection
  {
    collection: 'subscriptions',
    index: {userId: 1},
    options: {
      name: 'subscriptions_by_user',
      background: true
    }
  },
  {
    collection: 'subscriptions',
    index: {stripeSubscriptionId: 1},
    options: {
      name: 'subscriptions_by_stripe_id',
      unique: true,
      background: true
    }
  },
  {
    collection: 'subscriptions',
    index: {stripeCustomerId: 1},
    options: {
      name: 'subscriptions_by_customer',
      background: true
    }
  },
  {
    collection: 'subscriptions',
    index: {status: 1},
    options: {
      name: 'subscriptions_by_status',
      background: true
    }
  },
  {
    collection: 'subscriptions',
    index: {plan: 1, interval: 1},
    options: {
      name: 'subscriptions_by_plan_interval',
      background: true
    }
  },
  {
    collection: 'subscriptions',
    index: {currentPeriodEnd: 1},
    options: {
      name: 'subscriptions_by_period_end',
      background: true
    }
  },
  {
    collection: 'subscriptions',
    index: {createdAt: -1},
    options: {
      name: 'subscriptions_by_creation_date',
      background: true
    }
  },

  // Payment collection
  {
    collection: 'payments',
    index: {userId: 1, createdAt: -1},
    options: {
      name: 'payments_by_user_date',
      background: true
    }
  },
  {
    collection: 'payments',
    index: {stripePaymentIntentId: 1},
    options: {
      name: 'payments_by_stripe_intent',
      unique: true,
      background: true
    }
  },
  {
    collection: 'payments',
    index: {stripeCustomerId: 1},
    options: {
      name: 'payments_by_customer',
      background: true
    }
  },
  {
    collection: 'payments',
    index: {subscriptionId: 1},
    options: {
      name: 'payments_by_subscription',
      sparse: true,
      background: true
    }
  },
  {
    collection: 'payments',
    index: {status: 1},
    options: {
      name: 'payments_by_status',
      background: true
    }
  },
  {
    collection: 'payments',
    index: {type: 1},
    options: {
      name: 'payments_by_type',
      background: true
    }
  },
  {
    collection: 'payments',
    index: {disputed: 1},
    options: {
      name: 'payments_by_dispute_status',
      sparse: true,
      background: true
    }
  },
  {
    collection: 'payments',
    index: {createdAt: -1},
    options: {
      name: 'payments_by_creation_date',
      background: true
    }
  },
  {
    collection: 'payments',
    index: {amount: -1, currency: 1},
    options: {
      name: 'payments_by_amount_currency',
      background: true
    }
  },

  // User Profile collection indexes
  {
    collection: 'userprofiles',
    index: {userId: 1},
    options: {
      name: 'user_profiles_by_user',
      background: true
    }
  },
  {
    collection: 'userprofiles',
    index: {userId: 1, isDefault: 1},
    options: {
      name: 'user_default_profiles',
      background: true
    }
  },
  {
    collection: 'userprofiles',
    index: {profileType: 1, isActive: 1},
    options: {
      name: 'user_profiles_by_type',
      background: true
    }
  },
  {
    collection: 'userprofiles',
    index: {associatedAccounts: 1},
    options: {
      name: 'user_profiles_by_accounts',
      sparse: true,
      background: true
    }
  },

  // Performance monitoring indexes with proper partial filter
  {
    collection: 'expenses',
    index: {
      accountId: 1,
      date: -1
    },
    options: {
      name: 'recent_expenses_partial',
      partialFilterExpression: {
        date: {$gte: new Date('2024-01-01')}
      },
      background: true
    }
  },

  // TTL indexes for cleanup
  {
    collection: 'sessions', // If you have a sessions collection
    index: {expiresAt: 1},
    options: {
      name: 'session_expiry',
      expireAfterSeconds: 0,
      background: true
    }
  },
  {
    collection: 'userauths',
    index: {'refreshTokens.expiresAt': 1},
    options: {
      name: 'refresh_tokens_expiry',
      expireAfterSeconds: 0,
      background: true,
      sparse: true
    }
  },
  {
    collection: 'userauths',
    index: {userId: 1},
    options: {
      name: 'user_auth_by_user',
      unique: true,
      background: true
    }
  },
  {
    collection: 'passwordresets', // If you have password reset tokens
    index: {createdAt: 1},
    options: {
      name: 'password_reset_expiry',
      expireAfterSeconds: 3600, // 1 hour
      background: true
    }
  },

  // Compound indexes for complex queries
  {
    collection: 'expenses',
    index: {
      accountId: 1,
      userId: 1,
      date: -1,
      categoryId: 1,
      amount: -1
    },
    options: {
      name: 'expenses_full_composite',
      background: true
    }
  },

  // Geospatial index if you track expense locations
  {
    collection: 'expenses',
    index: {location: '2dsphere'},
    options: {
      name: 'expense_locations',
      sparse: true,
      background: true
    }
  }
];

/**
 * Critical indexes that should be created first for immediate performance impact
 */
export const CRITICAL_INDEXES: IndexDefinition[] = [
  {
    collection: 'users',
    index: {email: 1},
    options: {name: 'email_1', unique: true}
  },
  {
    collection: 'expenses',
    index: {accountId: 1, date: -1},
    options: {name: 'accountId_1_date_-1'}
  },
  {
    collection: 'expenses',
    index: {accountId: 1, isDeleted: 1, date: -1},
    options: {name: 'accountId_1_isDeleted_1_date_-1'}
  },
  {
    collection: 'expenses',
    index: {isRecurring: 1, 'recurringPattern.nextOccurrence': 1},
    options: {
      name: 'recurring_expenses_critical',
      partialFilterExpression: {isRecurring: true}
    }
  },
  {
    collection: 'accounts',
    index: {owner: 1},
    options: {name: 'owner_1'}
  },
  {
    collection: 'accounts',
    index: {'members.userId': 1},
    options: {name: 'members.userId_1'}
  },
  // Billing critical indexes
  {
    collection: 'billingcustomers',
    index: {userId: 1},
    options: {name: 'billing_customers_userId_1', unique: true}
  },
  {
    collection: 'billingcustomers',
    index: {stripeCustomerId: 1},
    options: {name: 'billing_customers_stripeCustomerId_1', unique: true}
  },
  {
    collection: 'subscriptions',
    index: {userId: 1},
    options: {name: 'subscriptions_userId_1'}
  },
  {
    collection: 'subscriptions',
    index: {stripeSubscriptionId: 1},
    options: {name: 'subscriptions_stripeSubscriptionId_1', unique: true}
  },
  {
    collection: 'payments',
    index: {userId: 1, createdAt: -1},
    options: {name: 'payments_userId_1_createdAt_-1'}
  },
  {
    collection: 'payments',
    index: {stripePaymentIntentId: 1},
    options: {name: 'payments_stripePaymentIntentId_1', unique: true}
  },
  // UserAuth critical indexes
  {
    collection: 'userauths',
    index: {userId: 1},
    options: {name: 'userauth_userId_1', unique: true}
  }
];

/**
 * Query patterns to optimize based on application usage
 */
export const QUERY_PATTERNS = {
  // Most common query patterns observed
  expenses: [
    'Find expenses by account and date range',
    'Find expenses by user and date range',
    'Find expenses by category and date range',
    'Find expenses by amount range',
    'Text search in expense descriptions'
  ],
  accounts: ['Find accounts by owner', 'Find accounts by member', 'Find accounts by type', 'Search account invitations by token'],
  budgets: ['Find active budgets by account', 'Find budgets by date range', 'Find category-specific budgets'],
  billing: [
    'Find billing customer by user',
    'Find billing customer by Stripe customer ID',
    'Find subscription by user',
    'Find subscription by Stripe subscription ID',
    'Find payments by user and date range',
    'Find payments by Stripe payment intent ID',
    'Find payments by subscription',
    'Find active subscriptions by plan',
    'Find subscriptions expiring soon',
    'Find disputed payments',
    'Find failed payments for retry'
  ],
  userProfiles: ['Find profiles by user', 'Find default profile by user', 'Find profiles by type and status', 'Find profiles associated with accounts']
};

/**
 * Index usage monitoring queries
 */
export const INDEX_MONITORING_QUERIES = {
  getIndexUsageStats: () => `
    db.runCommand({
      aggregate: "expenses",
      pipeline: [
        { $indexStats: {} },
        { $sort: { "accesses.ops": -1 } }
      ],
      cursor: {}
    })
  `,

  getSlowQueries: () => `
    db.setProfilingLevel(2, { slowms: 100 });
    db.system.profile.find().limit(10).sort({ ts: -1 }).pretty();
  `,

  explainQuery: (collection: string, query: any) => `
    db.${collection}.find(${JSON.stringify(query)}).explain("executionStats")
  `
};
