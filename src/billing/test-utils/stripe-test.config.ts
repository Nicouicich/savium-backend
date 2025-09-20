import { ConfigService } from '@nestjs/config';
import { stripeMockFactory } from './stripe-mock.factory';

/**
 * Stripe Testing Configuration
 * Provides consistent test configuration and utilities for Stripe tests
 */
export class StripeTestConfig {
  static readonly TEST_CONFIG = {
    stripe: {
      secretKey: 'sk_test_' + 'x'.repeat(99),
      publishableKey: 'pk_test_' + 'x'.repeat(99),
      webhookSecret: 'whsec_test_' + 'x'.repeat(32),
      apiVersion: '2024-12-18.acacia',
      defaultCurrency: 'usd',
      rateLimiting: {
        maxRetries: 3,
        retryDelay: 1000
      },
      subscription: {
        trialPeriodDays: 14,
        gracePeriodDays: 3,
        automaticTax: false,
        collectTaxId: false,
        defaultTaxBehavior: 'exclusive'
      },
      products: {
        personal: {
          priceId: 'price_test_personal',
          productId: 'prod_test_personal',
          features: ['basic_analytics', 'transaction_tracking', 'budget_management']
        },
        couple: {
          priceId: 'price_test_couple',
          productId: 'prod_test_couple',
          features: ['shared_accounts', 'joint_budgets', 'couple_insights']
        },
        family: {
          priceId: 'price_test_family',
          productId: 'prod_test_family',
          features: ['family_accounts', 'child_allowances', 'parental_controls']
        },
        business: {
          priceId: 'price_test_business',
          productId: 'prod_test_business',
          features: ['advanced_analytics', 'team_management', 'api_access', 'priority_support']
        }
      },
      security: {
        radarRules: false,
        requireAuthentication: true,
        allowedCountries: ['US', 'CA', 'GB', 'DE', 'FR'],
        blockedCountries: []
      },
      webhooks: {
        toleranceSeconds: 300,
        enabledEvents: [
          'customer.created',
          'customer.updated',
          'customer.deleted',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'customer.subscription.trial_will_end',
          'invoice.created',
          'invoice.payment_succeeded',
          'invoice.payment_failed',
          'invoice.upcoming',
          'payment_intent.created',
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'payment_method.attached',
          'payment_method.detached',
          'setup_intent.succeeded',
          'checkout.session.completed',
          'charge.dispute.created'
        ]
      },
      testing: {
        enabled: true,
        testClock: null,
        webhookTesting: true
      }
    },
    database: {
      uri: 'mongodb://localhost:27017/savium_test',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    },
    redis: {
      host: 'localhost',
      port: 6379,
      db: 15 // Use separate DB for tests
    }
  };

  /**
   * Create mock ConfigService for testing
   */
  static createMockConfigService(): jest.Mocked<ConfigService> {
    const configService = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
      set: jest.fn(),
      setEnvFilePaths: jest.fn(),
      changes$: {} as any
    } as unknown as jest.Mocked<ConfigService>;

    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = this.TEST_CONFIG;
      const keys = key.split('.');
      let value: any = config;

      for (const k of keys) {
        value = value?.[k];
      }

      return value !== undefined ? value : defaultValue;
    });

    return configService;
  }

  /**
   * Setup test environment
   */
  static setupTestEnvironment(): void {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.STRIPE_SECRET_KEY = this.TEST_CONFIG.stripe.secretKey;
    process.env.STRIPE_PUBLISHABLE_KEY = this.TEST_CONFIG.stripe.publishableKey;
    process.env.STRIPE_WEBHOOK_SECRET = this.TEST_CONFIG.stripe.webhookSecret;

    // Setup Stripe mocks
    stripeMockFactory.setupSuccessfulMocks();
  }

  /**
   * Reset test environment
   */
  static resetTestEnvironment(): void {
    stripeMockFactory.reset();
  }

  /**
   * Test data factories
   */
  static readonly TEST_DATA = {
    users: {
      validUser: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@savium.ai',
        password: 'SecurePass123!',
        accountType: 'personal'
      },
      adminUser: {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@savium.ai',
        password: 'AdminPass123!',
        role: 'ADMIN'
      }
    },
    customers: {
      validCustomer: {
        name: 'John Doe',
        email: 'test@savium.ai',
        phone: '+1234567890',
        accountType: 'personal',
        address: {
          line1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          country: 'US'
        }
      },
      businessCustomer: {
        name: 'Acme Corp',
        email: 'billing@acme.com',
        phone: '+1555123456',
        accountType: 'business',
        address: {
          line1: '456 Business Ave',
          line2: 'Suite 100',
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94105',
          country: 'US'
        }
      }
    },
    payments: {
      validPayment: {
        amount: 29.99,
        currency: 'usd',
        description: 'Test payment',
        paymentMethodTypes: ['card'],
        captureMethod: 'automatic'
      },
      largePayment: {
        amount: 999.99,
        currency: 'usd',
        description: 'Large test payment',
        paymentMethodTypes: ['card'],
        captureMethod: 'manual'
      },
      internationalPayment: {
        amount: 25.0,
        currency: 'eur',
        description: 'International payment',
        paymentMethodTypes: ['card', 'sepa_debit'],
        captureMethod: 'automatic'
      }
    },
    subscriptions: {
      personalPlan: {
        plan: 'personal',
        interval: 'monthly',
        amount: 999,
        currency: 'usd',
        trialPeriodDays: 14
      },
      businessPlan: {
        plan: 'business',
        interval: 'yearly',
        amount: 9999,
        currency: 'usd',
        trialPeriodDays: 30
      },
      familyPlan: {
        plan: 'family',
        interval: 'monthly',
        amount: 1999,
        currency: 'usd',
        trialPeriodDays: 7
      }
    },
    webhooks: {
      paymentSucceeded: {
        type: 'payment_intent.succeeded',
        data: {
          id: 'pi_test_payment_succeeded',
          status: 'succeeded',
          amount: 2999,
          currency: 'usd'
        }
      },
      subscriptionCreated: {
        type: 'customer.subscription.created',
        data: {
          id: 'sub_test_subscription',
          status: 'active',
          customer: 'cus_test_customer'
        }
      },
      invoiceFailed: {
        type: 'invoice.payment_failed',
        data: {
          id: 'in_test_failed_invoice',
          status: 'open',
          customer: 'cus_test_customer'
        }
      },
      disputeCreated: {
        type: 'charge.dispute.created',
        data: {
          id: 'dp_test_dispute',
          charge: 'ch_test_charge',
          reason: 'fraudulent'
        }
      }
    }
  };

  /**
   * Test scenarios for error handling
   */
  static readonly ERROR_SCENARIOS = {
    stripeErrors: {
      cardDeclined: {
        type: 'StripeCardError',
        code: 'card_declined',
        message: 'Your card was declined.'
      },
      rateLimitExceeded: {
        type: 'StripeRateLimitError',
        code: 'rate_limit',
        message: 'Too many requests'
      },
      invalidRequest: {
        type: 'StripeInvalidRequestError',
        code: 'parameter_invalid_empty',
        message: 'Invalid parameter'
      },
      apiConnection: {
        type: 'StripeConnectionError',
        code: 'connection_error',
        message: 'Network connection failed'
      },
      authentication: {
        type: 'StripeAuthenticationError',
        code: 'invalid_api_key',
        message: 'Invalid API key'
      }
    },
    webhookErrors: {
      invalidSignature: {
        type: 'StripeSignatureVerificationError',
        message: 'Invalid signature'
      },
      timestampTolerance: {
        type: 'StripeSignatureVerificationError',
        message: 'Timestamp outside tolerance'
      },
      malformedPayload: {
        type: 'SyntaxError',
        message: 'Unexpected token in JSON'
      }
    },
    databaseErrors: {
      connectionLost: {
        type: 'MongoNetworkError',
        message: 'Connection lost'
      },
      duplicateKey: {
        type: 'MongoError',
        code: 11000,
        message: 'Duplicate key error'
      },
      validationError: {
        type: 'ValidationError',
        message: 'Validation failed'
      }
    }
  };

  /**
   * Performance test configurations
   */
  static readonly PERFORMANCE_CONFIG = {
    loadTesting: {
      concurrentUsers: 100,
      requestsPerSecond: 50,
      testDuration: 60, // seconds
      rampUpTime: 10 // seconds
    },
    slaTargets: {
      responseTime: {
        p50: 100, // milliseconds
        p95: 200,
        p99: 500
      },
      availability: 99.9, // percentage
      errorRate: 0.1 // percentage
    },
    webhookProcessing: {
      maxProcessingTime: 1000, // milliseconds
      maxConcurrentEvents: 200,
      retryAttempts: 3,
      retryDelay: 1000 // milliseconds
    }
  };

  /**
   * Security test configurations
   */
  static readonly SECURITY_CONFIG = {
    authentication: {
      requireAuthentication: true,
      tokenExpiration: 900, // 15 minutes
      maxFailedAttempts: 5
    },
    rateLimiting: {
      windowSize: 60000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: false
    },
    inputValidation: {
      maxStringLength: 1000,
      allowedCurrencies: ['usd', 'eur', 'gbp', 'cad'],
      allowedCountries: ['US', 'CA', 'GB', 'DE', 'FR'],
      sanitizeInput: true
    },
    dataProtection: {
      encryptSensitiveData: true,
      maskCardNumbers: true,
      logSafeMode: true,
      piiRetentionDays: 2555 // 7 years
    }
  };

  /**
   * Create test JWT token
   */
  static createTestJwtToken(userId: string, role: string = 'USER'): string {
    // In real implementation, this would use proper JWT signing
    // For tests, we return a mock token
    return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke3VzZXJJZH0iLCJyb2xlIjoiJHtyb2xlfSIsImlhdCI6MTY0MDk5NTIwMCwiZXhwIjoxNjQwOTk2MTAwfQ.mock_signature`;
  }

  /**
   * Generate test IDs
   */
  static generateTestId(prefix: string = ''): string {
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return prefix ? `${prefix}_${id}` : id;
  }

  /**
   * Create test database connection options
   */
  static getTestDatabaseOptions(): any {
    return {
      uri: this.TEST_CONFIG.database.uri,
      options: {
        ...this.TEST_CONFIG.database.options,
        dbName: `savium_test_${Date.now()}` // Unique DB per test run
      }
    };
  }

  /**
   * Cleanup test data
   */
  static async cleanupTestData(): Promise<void> {
    // In real implementation, this would clean up test database
    // For now, just reset mocks
    this.resetTestEnvironment();
  }
}

// Export commonly used test data
export const { TEST_DATA, ERROR_SCENARIOS, PERFORMANCE_CONFIG, SECURITY_CONFIG } = StripeTestConfig;
