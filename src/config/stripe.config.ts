import { registerAs } from '@nestjs/config';

export default registerAs('stripe', () => ({
  // Stripe API Configuration
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  // API Version
  apiVersion: '2024-12-18.acacia' as const,

  // Connect Configuration (for marketplace scenarios)
  clientId: process.env.STRIPE_CLIENT_ID,

  // Currency and Locale
  defaultCurrency: process.env.STRIPE_DEFAULT_CURRENCY || 'usd',
  defaultLocale: process.env.STRIPE_DEFAULT_LOCALE || 'en',

  // Payment Configuration
  paymentMethods: {
    enabled: ['card', 'bank_transfer', 'us_bank_account', 'sepa_debit', 'ideal', 'giropay', 'sofort', 'bancontact', 'eps', 'p24', 'alipay', 'wechat_pay'],
    defaultPaymentMethod: 'card'
  },

  // Subscription Configuration
  subscription: {
    trialPeriodDays: parseInt(process.env.STRIPE_TRIAL_PERIOD_DAYS || '14'),
    gracePeriodDays: parseInt(process.env.STRIPE_GRACE_PERIOD_DAYS || '3'),
    automaticTax: process.env.STRIPE_AUTOMATIC_TAX === 'true',
    collectTaxId: process.env.STRIPE_COLLECT_TAX_ID === 'true',
    defaultTaxBehavior: process.env.STRIPE_DEFAULT_TAX_BEHAVIOR || 'exclusive'
  },

  // Product Configuration
  products: {
    personal: {
      priceId: process.env.STRIPE_PERSONAL_PRICE_ID,
      productId: process.env.STRIPE_PERSONAL_PRODUCT_ID,
      features: ['basic_analytics', 'expense_tracking', 'budget_management']
    },
    couple: {
      priceId: process.env.STRIPE_COUPLE_PRICE_ID,
      productId: process.env.STRIPE_COUPLE_PRODUCT_ID,
      features: ['shared_accounts', 'joint_budgets', 'couple_insights']
    },
    family: {
      priceId: process.env.STRIPE_FAMILY_PRICE_ID,
      productId: process.env.STRIPE_FAMILY_PRODUCT_ID,
      features: ['family_accounts', 'child_allowances', 'parental_controls']
    },
    business: {
      priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
      productId: process.env.STRIPE_BUSINESS_PRODUCT_ID,
      features: ['advanced_analytics', 'team_management', 'api_access', 'priority_support']
    }
  },

  // Security Configuration
  security: {
    radarRules: process.env.STRIPE_RADAR_RULES === 'true',
    requireAuthentication: process.env.STRIPE_REQUIRE_AUTH === 'true',
    allowedCountries: process.env.STRIPE_ALLOWED_COUNTRIES?.split(',') || [],
    blockedCountries: process.env.STRIPE_BLOCKED_COUNTRIES?.split(',') || []
  },

  // Webhook Configuration
  webhooks: {
    toleranceSeconds: parseInt(process.env.STRIPE_WEBHOOK_TOLERANCE || '300'),
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

  // Rate Limiting
  rateLimiting: {
    maxRetries: parseInt(process.env.STRIPE_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.STRIPE_RETRY_DELAY || '1000')
  },

  // Testing Configuration
  testing: {
    enabled: process.env.NODE_ENV !== 'production',
    testClock: process.env.STRIPE_TEST_CLOCK_ID,
    webhookTesting: process.env.STRIPE_WEBHOOK_TESTING === 'true'
  }
}));
