import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';

import { DatabaseService } from '../database/database.service';
import { PaymentSecurityService } from './services/payment-security.service';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { StripeService } from './services/stripe.service';

import { BillingCustomer, BillingCustomerSchema } from './schemas/billing-customer.schema';
import { EnhancedPayment, EnhancedPaymentSchema } from './schemas/enhanced-payment.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';

import { stripeConfig } from '../config';

describe('Billing Integration Tests', () => {
  let module: TestingModule;
  let stripeService: StripeService;
  let webhookService: StripeWebhookService;
  let securityService: PaymentSecurityService;
  let databaseService: DatabaseService;
  let mongoServer: MongoMemoryServer;
  let connection: Connection;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [stripeConfig]
        }),
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: BillingCustomer.name, schema: BillingCustomerSchema },
          { name: Subscription.name, schema: SubscriptionSchema },
          { name: Payment.name, schema: PaymentSchema },
          { name: EnhancedPayment.name, schema: EnhancedPaymentSchema }
        ])
      ],
      providers: [
        StripeService,
        StripeWebhookService,
        PaymentSecurityService,
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const config = {
                'stripe.secretKey': 'sk_test_fake_key_for_testing',
                'stripe.publishableKey': 'pk_test_fake_key_for_testing',
                'stripe.webhookSecret': 'whsec_test_fake_secret',
                'stripe.apiVersion': '2024-12-18.acacia',
                'stripe.defaultCurrency': 'usd',
                'stripe.products.personal.priceId': 'price_test_personal',
                'stripe.products.personal.productId': 'prod_test_personal',
                'stripe.subscription.trialPeriodDays': 14,
                'stripe.subscription.automaticTax': false,
                'stripe.rateLimiting.maxRetries': 3,
                'stripe.rateLimiting.retryDelay': 1000
              };
              return config[key];
            }
          }
        }
      ]
    }).compile();

    stripeService = module.get<StripeService>(StripeService);
    webhookService = module.get<StripeWebhookService>(StripeWebhookService);
    securityService = module.get<PaymentSecurityService>(PaymentSecurityService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    connection = module.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongoServer.stop();
    await module.close();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('StripeService', () => {
    it('should be defined', () => {
      expect(stripeService).toBeDefined();
    });

    it('should get publishable key', () => {
      const publishableKey = stripeService.getPublishableKey();
      expect(publishableKey).toBe('pk_test_fake_key_for_testing');
    });

    it('should create customer data', async () => {
      const customerData = {
        userId: '60d0fe4f5311236168a109ca',
        email: 'test@example.com',
        name: 'Test User',
        accountType: 'personal'
      };

      // Mock Stripe customer creation
      jest.spyOn(stripeService as any, 'ensureStripeInitialized').mockImplementation(() => {});
      jest.spyOn(stripeService as any, 'stripe', 'get').mockReturnValue({
        customers: {
          create: jest.fn().mockResolvedValue({
            id: 'cus_test_customer_id',
            email: customerData.email,
            name: customerData.name
          })
        }
      });

      const customer = await stripeService.createOrGetCustomer(customerData);

      expect(customer).toBeDefined();
      expect(customer.userId).toBe(customerData.userId);
      expect(customer.email).toBe(customerData.email);
      expect(customer.name).toBe(customerData.name);
    });
  });

  describe('PaymentSecurityService', () => {
    it('should be defined', () => {
      expect(securityService).toBeDefined();
    });

    it('should perform security check for valid payment', async () => {
      const userId = '60d0fe4f5311236168a109ca';
      const amount = 100;
      const currency = 'usd';

      const result = await securityService.performSecurityCheck(userId, amount, currency);

      expect(result).toBeDefined();
      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe('low');
      expect(Array.isArray(result.reasons)).toBe(true);
    });

    it('should block payments from blocked countries', async () => {
      const userId = '60d0fe4f5311236168a109ca';
      const amount = 100;
      const currency = 'usd';
      const billingDetails = {
        address: {
          country: 'IR' // Blocked country
        }
      };

      const result = await securityService.performSecurityCheck(userId, amount, currency, null, billingDetails);

      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe('critical');
      expect(result.reasons).toContain('Payments blocked from country: IR');
    });

    it('should assess payment risk correctly', async () => {
      const userId = '60d0fe4f5311236168a109ca';
      const amount = 5000; // High amount
      const currency = 'usd';

      const assessment = await securityService.assessPaymentRisk(userId, amount, currency);

      expect(assessment).toBeDefined();
      expect(assessment.score).toBeGreaterThan(0);
      expect(assessment.level).toBeDefined();
      expect(Array.isArray(assessment.factors)).toBe(true);
    });
  });

  describe('StripeWebhookService', () => {
    it('should be defined', () => {
      expect(webhookService).toBeDefined();
    });

    it('should process payment intent succeeded event', async () => {
      // Create a mock payment record first
      const mockPayment = new connection.models.EnhancedPayment({
        userId: '60d0fe4f5311236168a109ca',
        stripePaymentIntentId: 'pi_test_payment_intent',
        amount: 100,
        currency: 'usd',
        status: 'requires_confirmation',
        paymentMethod: 'stripe',
        type: 'one_time'
      });
      await mockPayment.save();

      const mockEvent = {
        id: 'evt_test_event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_payment_intent',
            status: 'succeeded',
            amount: 10000,
            currency: 'usd',
            charges: {
              data: [
                {
                  payment_method_details: {
                    card: {
                      brand: 'visa',
                      last4: '4242'
                    }
                  },
                  receipt_url: 'https://pay.stripe.com/receipts/test'
                }
              ]
            }
          }
        }
      } as any;

      await webhookService.processWebhookEvent(mockEvent);

      // Verify payment was updated
      const updatedPayment = await connection.models.EnhancedPayment.findOne({
        stripePaymentIntentId: 'pi_test_payment_intent'
      });

      expect(updatedPayment.status).toBe('succeeded');
      expect(updatedPayment.processedAt).toBeDefined();
    });
  });

  describe('Database Transactions', () => {
    it('should handle database transactions correctly', async () => {
      const result = await databaseService.withTransaction(async session => {
        const customer = new connection.models.BillingCustomer({
          userId: '60d0fe4f5311236168a109ca',
          stripeCustomerId: 'cus_test_customer',
          email: 'test@example.com',
          name: 'Test User',
          accountType: 'personal'
        });

        await customer.save({ session });
        return customer;
      });

      expect(result).toBeDefined();
      expect(result.userId).toBe('60d0fe4f5311236168a109ca');

      // Verify the customer was saved
      const savedCustomer = await connection.models.BillingCustomer.findOne({
        userId: '60d0fe4f5311236168a109ca'
      });
      expect(savedCustomer).toBeDefined();
    });

    it('should rollback on transaction failure', async () => {
      try {
        await databaseService.withTransaction(async session => {
          const customer = new connection.models.BillingCustomer({
            userId: '60d0fe4f5311236168a109cb',
            stripeCustomerId: 'cus_test_customer_2',
            email: 'test2@example.com',
            name: 'Test User 2',
            accountType: 'personal'
          });

          await customer.save({ session });

          // Force an error to trigger rollback
          throw new Error('Transaction test error');
        });
      } catch (error) {
        expect(error.message).toBe('Transaction test error');
      }

      // Verify the customer was not saved (rolled back)
      const savedCustomer = await connection.models.BillingCustomer.findOne({
        userId: '60d0fe4f5311236168a109cb'
      });
      expect(savedCustomer).toBeNull();
    });
  });

  describe('Schema Validation', () => {
    it('should validate EnhancedPayment schema', async () => {
      const payment = new connection.models.EnhancedPayment({
        userId: '60d0fe4f5311236168a109ca',
        stripePaymentIntentId: 'pi_test_validation',
        amount: 100,
        currency: 'usd',
        status: 'succeeded',
        paymentMethod: 'stripe',
        type: 'one_time'
      });

      const savedPayment = await payment.save();
      expect(savedPayment).toBeDefined();
      expect(savedPayment.statusHistory).toHaveLength(1);
      expect(savedPayment.statusHistory[0].status).toBe('succeeded');
    });

    it('should enforce required fields', async () => {
      const payment = new connection.models.EnhancedPayment({
        // Missing required fields
        amount: 100
      });

      try {
        await payment.save();
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
      }
    });
  });

  describe('Integration End-to-End', () => {
    it('should complete full payment flow', async () => {
      // This test demonstrates the complete payment flow
      // In a real environment, this would interact with Stripe's test API

      const userId = '60d0fe4f5311236168a109ca';
      const customerData = {
        userId,
        email: 'integration@example.com',
        name: 'Integration Test User',
        accountType: 'personal'
      };

      // Step 1: Security check
      const securityCheck = await securityService.performSecurityCheck(userId, 100, 'usd');
      expect(securityCheck.allowed).toBe(true);

      // Step 2: Risk assessment
      const riskAssessment = await securityService.assessPaymentRisk(userId, 100, 'usd');
      expect(riskAssessment.level).toBe('normal');

      // Step 3: Create payment record (simulated)
      const payment = new connection.models.EnhancedPayment({
        userId,
        stripePaymentIntentId: 'pi_integration_test',
        amount: 100,
        currency: 'usd',
        status: 'succeeded',
        paymentMethod: 'stripe',
        type: 'one_time',
        riskAssessment: {
          level: riskAssessment.level,
          score: riskAssessment.score,
          reason: 'Integration test'
        }
      });

      const savedPayment = await payment.save();
      expect(savedPayment).toBeDefined();
      expect(savedPayment.riskAssessment.level).toBe('normal');
    });
  });
});

// Mock Stripe events for testing
export const mockStripeEvents = {
  paymentIntentSucceeded: {
    id: 'evt_test_payment_succeeded',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test_payment_intent',
        status: 'succeeded',
        amount: 10000,
        currency: 'usd',
        customer: 'cus_test_customer',
        payment_method: 'pm_test_card',
        charges: {
          data: [
            {
              id: 'ch_test_charge',
              payment_method_details: {
                card: {
                  brand: 'visa',
                  last4: '4242',
                  exp_month: 12,
                  exp_year: 2025,
                  country: 'US'
                }
              },
              receipt_url: 'https://pay.stripe.com/receipts/test',
              receipt_number: 'receipt_test_123'
            }
          ]
        }
      }
    }
  },

  subscriptionCreated: {
    id: 'evt_test_subscription_created',
    type: 'customer.subscription.created',
    data: {
      object: {
        id: 'sub_test_subscription',
        customer: 'cus_test_customer',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        trial_start: null,
        trial_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
        items: {
          data: [
            {
              id: 'si_test_item',
              price: {
                id: 'price_test_personal',
                product: 'prod_test_personal'
              },
              quantity: 1
            }
          ]
        }
      }
    }
  },

  disputeCreated: {
    id: 'evt_test_dispute_created',
    type: 'charge.dispute.created',
    data: {
      object: {
        id: 'dp_test_dispute',
        charge: 'ch_test_charge',
        reason: 'fraudulent',
        status: 'warning_needs_response',
        created: Math.floor(Date.now() / 1000),
        evidence: {},
        evidence_details: {
          due_by: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
        }
      }
    }
  }
};
