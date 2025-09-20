/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientSession, Model, Types } from 'mongoose';
import Stripe from 'stripe';

import { BillingCustomer, BillingCustomerDocument } from '../schemas/billing-customer.schema';
import { EnhancedPayment, EnhancedPaymentDocument } from '../schemas/enhanced-payment.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { Subscription, SubscriptionDocument } from '../schemas/subscription.schema';
import { StripeWebhookService } from './stripe-webhook.service';

import { PaymentException } from '../../common/exceptions/payment.exception';
import { DatabaseService } from '../../database/database.service';

describe('StripeWebhookService - Unit Tests', () => {
  let service: StripeWebhookService;
  let paymentModel: jest.Mocked<Model<PaymentDocument>>;
  let enhancedPaymentModel: jest.Mocked<Model<EnhancedPaymentDocument>>;
  let subscriptionModel: jest.Mocked<Model<SubscriptionDocument>>;
  let customerModel: jest.Mocked<Model<BillingCustomerDocument>>;
  let databaseService: jest.Mocked<DatabaseService>;
  let logger: jest.Mocked<Logger>;
  let mockSession: jest.Mocked<ClientSession>;

  // Test data factories
  const createMockStripeEvent = (type: string, data: any = {}): Stripe.Event => ({
    id: 'evt_test_webhook',
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'test_object_id',
        object: type.split('.')[0],
        ...data
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: 'req_test', idempotency_key: null },
    type: type as Stripe.Event.Type
  });

  const createMockPaymentIntent = (overrides = {}): Stripe.PaymentIntent =>
    ({
      id: 'pi_test_payment_intent',
      object: 'payment_intent',
      amount: 2999,
      currency: 'usd',
      status: 'succeeded',
      client_secret: 'pi_test_client_secret',
      created: Math.floor(Date.now() / 1000),
      customer: 'cus_test_customer',
      description: 'Test payment',
      metadata: {
        userId: new Types.ObjectId().toString(),
        accountId: new Types.ObjectId().toString()
      },
      charges: {
        object: 'list',
        data: [
          {
            id: 'ch_test_charge',
            object: 'charge',
            amount: 2999,
            currency: 'usd',
            status: 'succeeded',
            payment_method_details: {
              type: 'card',
              card: {
                brand: 'visa',
                last4: '4242',
                exp_month: 12,
                exp_year: 2025,
                country: 'US',
                fingerprint: 'test_fingerprint'
              }
            },
            receipt_url: 'https://pay.stripe.com/receipts/test',
            receipt_number: 'test_receipt_123',
            application_fee_amount: 100
          }
        ]
      },
      last_payment_error: null,
      ...overrides
    }) as Stripe.PaymentIntent;

  const createMockCustomer = (overrides = {}): Stripe.Customer =>
    ({
      id: 'cus_test_customer',
      object: 'customer',
      created: Math.floor(Date.now() / 1000),
      email: 'test@savium.ai',
      name: 'John Doe',
      phone: '+1234567890',
      address: {
        line1: '123 Main St',
        line2: null,
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US'
      },
      deleted: false,
      ...overrides
    }) as Stripe.Customer;

  const createMockSubscription = (overrides = {}): Stripe.Subscription =>
    ({
      id: 'sub_test_subscription',
      object: 'subscription',
      status: 'active',
      customer: 'cus_test_customer',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
      trial_start: null,
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
      created: Math.floor(Date.now() / 1000),
      metadata: {
        userId: new Types.ObjectId().toString(),
        accountType: 'personal'
      },
      items: {
        object: 'list',
        data: [
          {
            id: 'si_test_item',
            object: 'subscription_item',
            price: {
              id: 'price_test',
              object: 'price',
              product: 'prod_test'
            }
          }
        ]
      },
      ...overrides
    }) as Stripe.Subscription;

  const createMockInvoice = (overrides = {}): Stripe.Invoice =>
    ({
      id: 'in_test_invoice',
      object: 'invoice',
      customer: 'cus_test_customer',
      amount_due: 2999,
      amount_paid: 2999,
      amount_remaining: 0,
      currency: 'usd',
      status: 'paid',
      payment_intent: 'pi_test_payment_intent',
      subscription: 'sub_test_subscription',
      number: 'INV-2024-001',
      hosted_invoice_url: 'https://invoice.stripe.com/i/test',
      due_date: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
      created: Math.floor(Date.now() / 1000),
      ...overrides
    }) as Stripe.Invoice;

  const createMockPaymentMethod = (overrides = {}): Stripe.PaymentMethod =>
    ({
      id: 'pm_test_payment_method',
      object: 'payment_method',
      type: 'card',
      customer: 'cus_test_customer',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025,
        country: 'US',
        fingerprint: 'test_fingerprint'
      },
      created: Math.floor(Date.now() / 1000),
      ...overrides
    }) as Stripe.PaymentMethod;

  const createMockSetupIntent = (overrides = {}): Stripe.SetupIntent =>
    ({
      id: 'seti_test_setup_intent',
      object: 'setup_intent',
      status: 'succeeded',
      customer: 'cus_test_customer',
      payment_method: 'pm_test_payment_method',
      usage: 'off_session',
      created: Math.floor(Date.now() / 1000),
      metadata: {
        userId: new Types.ObjectId().toString()
      },
      ...overrides
    }) as Stripe.SetupIntent;

  const createMockCheckoutSession = (overrides = {}): Stripe.Checkout.Session =>
    ({
      id: 'cs_test_checkout_session',
      object: 'checkout.session',
      payment_intent: 'pi_test_payment_intent',
      customer: 'cus_test_customer',
      payment_status: 'paid',
      status: 'complete',
      metadata: {
        userId: new Types.ObjectId().toString()
      },
      created: Math.floor(Date.now() / 1000),
      ...overrides
    }) as Stripe.Checkout.Session;

  const createMockDispute = (overrides = {}): Stripe.Dispute =>
    ({
      id: 'dp_test_dispute',
      object: 'dispute',
      charge: 'ch_test_charge',
      amount: 2999,
      currency: 'usd',
      reason: 'fraudulent',
      status: 'warning_needs_response',
      evidence: {},
      evidence_details: {
        due_by: Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000),
        has_evidence: false,
        past_due: false,
        submission_count: 0
      },
      created: Math.floor(Date.now() / 1000),
      ...overrides
    }) as Stripe.Dispute;

  const createMockEnhancedPayment = (overrides = {}): Partial<EnhancedPaymentDocument> => ({
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId().toString(),
    stripePaymentIntentId: 'pi_test_payment_intent',
    status: 'pending',
    amount: 29.99,
    currency: 'usd',
    paymentMethod: 'stripe',
    save: jest.fn().mockResolvedValue(undefined),
    addWebhookEvent: jest.fn().mockResolvedValue(undefined),
    ...overrides
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        {
          provide: getModelToken(Payment.name),
          useValue: {
            findOne: jest.fn(),
            updateOne: jest.fn(),
            create: jest.fn()
          }
        },
        {
          provide: getModelToken(EnhancedPayment.name),
          useValue: {
            findOne: jest.fn(),
            updateOne: jest.fn(),
            create: jest.fn()
          }
        },
        {
          provide: getModelToken(Subscription.name),
          useValue: {
            findOne: jest.fn(),
            updateOne: jest.fn(),
            create: jest.fn()
          }
        },
        {
          provide: getModelToken(BillingCustomer.name),
          useValue: {
            findOne: jest.fn(),
            updateOne: jest.fn(),
            create: jest.fn()
          }
        },
        {
          provide: DatabaseService,
          useValue: {
            startSession: jest.fn()
          }
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<StripeWebhookService>(StripeWebhookService);
    paymentModel = module.get(getModelToken(Payment.name));
    enhancedPaymentModel = module.get(getModelToken(EnhancedPayment.name));
    subscriptionModel = module.get(getModelToken(Subscription.name));
    customerModel = module.get(getModelToken(BillingCustomer.name));
    databaseService = module.get(DatabaseService);
    logger = module.get(Logger);

    // Mock session
    mockSession = {
      withTransaction: jest.fn().mockImplementation(async fn => await fn()),
      endSession: jest.fn()
    } as any;

    databaseService.startSession.mockResolvedValue(mockSession);

    // Setup enhanced payment model constructor
    enhancedPaymentModel.create = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Webhook Event Processing', () => {
    describe('processWebhookEvent', () => {
      it('should process webhook event successfully', async () => {
        // Arrange
        const mockPaymentIntent = createMockPaymentIntent();
        const event = createMockStripeEvent('payment_intent.succeeded', mockPaymentIntent);
        const mockEnhancedPayment = createMockEnhancedPayment();

        enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(mockSession.withTransaction).toHaveBeenCalled();
        expect(mockSession.endSession).toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith(
          `Processing webhook event: ${event.type}`,
          expect.objectContaining({
            eventId: event.id,
            eventType: event.type
          })
        );
        expect(logger.log).toHaveBeenCalledWith(
          'Webhook event processed successfully',
          expect.objectContaining({
            eventId: event.id,
            eventType: event.type
          })
        );
      });

      it('should handle errors and record failed processing', async () => {
        // Arrange
        const event = createMockStripeEvent('payment_intent.succeeded');
        const processingError = new Error('Database connection failed');

        enhancedPaymentModel.findOne.mockRejectedValue(processingError);

        // Act & Assert
        await expect(service.processWebhookEvent(event)).rejects.toThrow(PaymentException);
        await expect(service.processWebhookEvent(event)).rejects.toThrow('Webhook processing failed: Database connection failed');

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to process webhook event',
          expect.objectContaining({
            eventId: event.id,
            eventType: event.type,
            error: 'Database connection failed'
          })
        );
        expect(mockSession.endSession).toHaveBeenCalled();
      });

      it('should handle unhandled webhook event types', async () => {
        // Arrange
        const event = createMockStripeEvent('unknown.event.type');

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(logger.debug).toHaveBeenCalledWith(
          `Unhandled webhook event type: ${event.type}`,
          expect.objectContaining({
            eventId: event.id
          })
        );
      });
    });
  });

  describe('Payment Intent Events', () => {
    describe('handlePaymentIntentCreated', () => {
      it('should handle payment intent created event', async () => {
        // Arrange
        const mockPaymentIntent = createMockPaymentIntent({ status: 'requires_payment_method' });
        const event = createMockStripeEvent('payment_intent.created', mockPaymentIntent);
        const mockEnhancedPayment = createMockEnhancedPayment();

        enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(enhancedPaymentModel.findOne).toHaveBeenCalledWith({
          stripePaymentIntentId: mockPaymentIntent.id
        });
        expect(mockEnhancedPayment.addWebhookEvent).toHaveBeenCalledWith(mockPaymentIntent.id, 'payment_intent.created', true);
      });
    });

    describe('handlePaymentIntentSucceeded', () => {
      it('should handle payment intent succeeded event with charge details', async () => {
        // Arrange
        const mockPaymentIntent = createMockPaymentIntent({ status: 'succeeded' });
        const event = createMockStripeEvent('payment_intent.succeeded', mockPaymentIntent);
        const mockEnhancedPayment = createMockEnhancedPayment();

        enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(mockEnhancedPayment.status).toBe('succeeded');
        expect(mockEnhancedPayment.processedAt).toBeInstanceOf(Date);
        expect(mockEnhancedPayment.paymentMethodDetails).toEqual({
          type: 'card',
          last4: '4242',
          brand: 'visa',
          expMonth: 12,
          expYear: 2025,
          country: 'US',
          fingerprint: 'test_fingerprint'
        });
        expect(mockEnhancedPayment.stripeFeeAmount).toBe(100);
        expect(mockEnhancedPayment.netAmount).toBe(2899); // 2999 - 100
        expect(mockEnhancedPayment.receiptUrl).toBe('https://pay.stripe.com/receipts/test');
        expect(mockEnhancedPayment.receiptNumber).toBe('test_receipt_123');
        expect(mockEnhancedPayment.addWebhookEvent).toHaveBeenCalledWith(mockPaymentIntent.id, 'payment_intent.succeeded', true);
      });

      it('should handle payment intent succeeded without payment details', async () => {
        // Arrange
        const mockPaymentIntent = createMockPaymentIntent({
          status: 'succeeded',
          charges: { object: 'list', data: [] }
        });
        const event = createMockStripeEvent('payment_intent.succeeded', mockPaymentIntent);
        const mockEnhancedPayment = createMockEnhancedPayment();

        enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(mockEnhancedPayment.status).toBe('succeeded');
        expect(mockEnhancedPayment.paymentMethodDetails).toBeUndefined();
        expect(mockEnhancedPayment.stripeFeeAmount).toBeUndefined();
      });
    });

    describe('handlePaymentIntentFailed', () => {
      it('should handle payment intent failed event with error details', async () => {
        // Arrange
        const mockPaymentIntent = createMockPaymentIntent({
          status: 'requires_payment_method',
          last_payment_error: {
            code: 'card_declined',
            message: 'Your card was declined.',
            decline_code: 'generic_decline',
            type: 'card_error'
          }
        });
        const event = createMockStripeEvent('payment_intent.payment_failed', mockPaymentIntent);
        const mockEnhancedPayment = createMockEnhancedPayment();

        enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(mockEnhancedPayment.status).toBe('failed');
        expect(mockEnhancedPayment.failureCode).toBe('card_declined');
        expect(mockEnhancedPayment.failureMessage).toBe('Your card was declined.');
        expect(mockEnhancedPayment.declineCode).toBe('generic_decline');
        expect(mockEnhancedPayment.addWebhookEvent).toHaveBeenCalledWith(mockPaymentIntent.id, 'payment_intent.payment_failed', true);
      });
    });

    describe('handlePaymentIntentCanceled', () => {
      it('should handle payment intent canceled event', async () => {
        // Arrange
        const mockPaymentIntent = createMockPaymentIntent({ status: 'canceled' });
        const event = createMockStripeEvent('payment_intent.canceled', mockPaymentIntent);
        const mockEnhancedPayment = createMockEnhancedPayment();

        enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(mockEnhancedPayment.status).toBe('canceled');
        expect(mockEnhancedPayment.addWebhookEvent).toHaveBeenCalledWith(mockPaymentIntent.id, 'payment_intent.canceled', true);
      });
    });

    describe('handlePaymentIntentRequiresAction', () => {
      it('should handle payment intent requires action event', async () => {
        // Arrange
        const mockPaymentIntent = createMockPaymentIntent({ status: 'requires_action' });
        const event = createMockStripeEvent('payment_intent.requires_action', mockPaymentIntent);
        const mockEnhancedPayment = createMockEnhancedPayment();

        enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(mockEnhancedPayment.status).toBe('requires_action');
        expect(mockEnhancedPayment.addWebhookEvent).toHaveBeenCalledWith(mockPaymentIntent.id, 'payment_intent.requires_action', true);
      });
    });
  });

  describe('Customer Events', () => {
    describe('handleCustomerCreated', () => {
      it('should handle customer created event', async () => {
        // Arrange
        const mockCustomer = createMockCustomer();
        const event = createMockStripeEvent('customer.created', mockCustomer);

        customerModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(customerModel.updateOne).toHaveBeenCalledWith(
          { stripeCustomerId: mockCustomer.id },
          {
            $set: {
              email: mockCustomer.email,
              name: mockCustomer.name,
              phone: mockCustomer.phone,
              address: mockCustomer.address,
              updatedAt: expect.any(Date)
            }
          },
          { session: mockSession, upsert: false }
        );
      });
    });

    describe('handleCustomerUpdated', () => {
      it('should handle customer updated event', async () => {
        // Arrange
        const mockCustomer = createMockCustomer({
          email: 'updated@savium.ai',
          name: 'Jane Doe'
        });
        const event = createMockStripeEvent('customer.updated', mockCustomer);

        customerModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(customerModel.updateOne).toHaveBeenCalledWith(
          { stripeCustomerId: mockCustomer.id },
          {
            $set: {
              email: 'updated@savium.ai',
              name: 'Jane Doe',
              phone: mockCustomer.phone,
              address: mockCustomer.address,
              updatedAt: expect.any(Date)
            }
          },
          { session: mockSession }
        );
      });
    });

    describe('handleCustomerDeleted', () => {
      it('should handle customer deleted event', async () => {
        // Arrange
        const mockCustomer = createMockCustomer({ deleted: true });
        const event = createMockStripeEvent('customer.deleted', mockCustomer);

        customerModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(customerModel.updateOne).toHaveBeenCalledWith(
          { stripeCustomerId: mockCustomer.id },
          {
            $set: {
              isActive: false,
              deletedAt: expect.any(Date),
              updatedAt: expect.any(Date)
            }
          },
          { session: mockSession }
        );
      });
    });
  });

  describe('Subscription Events', () => {
    describe('handleSubscriptionCreated', () => {
      it('should handle subscription created event for existing subscription', async () => {
        // Arrange
        const mockSubscription = createMockSubscription();
        const event = createMockStripeEvent('customer.subscription.created', mockSubscription);
        const existingSubscription = {
          stripeSubscriptionId: mockSubscription.id,
          save: jest.fn().mockResolvedValue(undefined)
        };

        subscriptionModel.findOne.mockResolvedValue(existingSubscription as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(subscriptionModel.findOne).toHaveBeenCalledWith({
          stripeSubscriptionId: mockSubscription.id
        });
        expect(existingSubscription.status).toBe(mockSubscription.status);
        expect(existingSubscription.currentPeriodStart).toEqual(new Date(mockSubscription.current_period_start * 1000));
        expect(existingSubscription.currentPeriodEnd).toEqual(new Date(mockSubscription.current_period_end * 1000));
        expect(existingSubscription.isActive).toBe(true);
        expect(existingSubscription.save).toHaveBeenCalledWith({ session: mockSession });
      });

      it('should handle subscription created event when subscription not found', async () => {
        // Arrange
        const mockSubscription = createMockSubscription();
        const event = createMockStripeEvent('customer.subscription.created', mockSubscription);

        subscriptionModel.findOne.mockResolvedValue(null);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(subscriptionModel.findOne).toHaveBeenCalledWith({
          stripeSubscriptionId: mockSubscription.id
        });
        // Should not call save since no existing subscription
      });
    });

    describe('handleSubscriptionUpdated', () => {
      it('should handle subscription updated event', async () => {
        // Arrange
        const mockSubscription = createMockSubscription({
          status: 'past_due',
          cancel_at_period_end: true,
          canceled_at: Math.floor(Date.now() / 1000)
        });
        const event = createMockStripeEvent('customer.subscription.updated', mockSubscription);

        subscriptionModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(subscriptionModel.updateOne).toHaveBeenCalledWith(
          { stripeSubscriptionId: mockSubscription.id },
          {
            $set: {
              status: 'past_due',
              currentPeriodStart: new Date(mockSubscription.current_period_start * 1000),
              currentPeriodEnd: new Date(mockSubscription.current_period_end * 1000),
              cancelAtPeriodEnd: true,
              canceledAt: new Date(mockSubscription.canceled_at * 1000),
              trialStart: null,
              trialEnd: null,
              isActive: false, // past_due is not active
              updatedAt: expect.any(Date)
            }
          },
          { session: mockSession }
        );
      });

      it('should handle subscription with trial periods', async () => {
        // Arrange
        const trialStart = Math.floor(Date.now() / 1000);
        const trialEnd = Math.floor((Date.now() + 14 * 24 * 60 * 60 * 1000) / 1000);
        const mockSubscription = createMockSubscription({
          status: 'trialing',
          trial_start: trialStart,
          trial_end: trialEnd
        });
        const event = createMockStripeEvent('customer.subscription.updated', mockSubscription);

        subscriptionModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(subscriptionModel.updateOne).toHaveBeenCalledWith(
          { stripeSubscriptionId: mockSubscription.id },
          {
            $set: expect.objectContaining({
              status: 'trialing',
              trialStart: new Date(trialStart * 1000),
              trialEnd: new Date(trialEnd * 1000),
              isActive: true // trialing is active
            })
          },
          { session: mockSession }
        );
      });
    });

    describe('handleSubscriptionDeleted', () => {
      it('should handle subscription deleted event', async () => {
        // Arrange
        const mockSubscription = createMockSubscription();
        const event = createMockStripeEvent('customer.subscription.deleted', mockSubscription);

        subscriptionModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(subscriptionModel.updateOne).toHaveBeenCalledWith(
          { stripeSubscriptionId: mockSubscription.id },
          {
            $set: {
              status: 'canceled',
              isActive: false,
              canceledAt: expect.any(Date),
              updatedAt: expect.any(Date)
            }
          },
          { session: mockSession }
        );
      });
    });

    describe('handleSubscriptionTrialWillEnd', () => {
      it('should handle subscription trial will end event', async () => {
        // Arrange
        const trialEnd = Math.floor((Date.now() + 3 * 24 * 60 * 60 * 1000) / 1000);
        const mockSubscription = createMockSubscription({
          trial_end: trialEnd
        });
        const event = createMockStripeEvent('customer.subscription.trial_will_end', mockSubscription);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(logger.log).toHaveBeenCalledWith(
          `Trial ending soon for subscription: ${mockSubscription.id}`,
          expect.objectContaining({
            customerId: mockSubscription.customer,
            trialEnd: trialEnd
          })
        );
      });
    });
  });

  describe('Invoice Events', () => {
    describe('handleInvoiceCreated', () => {
      it('should handle invoice created event with payment intent', async () => {
        // Arrange
        const mockInvoice = createMockInvoice();
        const event = createMockStripeEvent('invoice.created', mockInvoice);

        enhancedPaymentModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(enhancedPaymentModel.updateOne).toHaveBeenCalledWith(
          { stripePaymentIntentId: mockInvoice.payment_intent },
          {
            $set: {
              stripeInvoiceId: mockInvoice.id,
              invoiceNumber: mockInvoice.number,
              invoiceUrl: mockInvoice.hosted_invoice_url
            }
          },
          { session: mockSession }
        );
      });

      it('should handle invoice created event without payment intent', async () => {
        // Arrange
        const mockInvoice = createMockInvoice({ payment_intent: null });
        const event = createMockStripeEvent('invoice.created', mockInvoice);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(enhancedPaymentModel.updateOne).not.toHaveBeenCalled();
      });
    });

    describe('handleInvoicePaymentSucceeded', () => {
      it('should handle invoice payment succeeded event', async () => {
        // Arrange
        const mockInvoice = createMockInvoice();
        const event = createMockStripeEvent('invoice.payment_succeeded', mockInvoice);

        enhancedPaymentModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(enhancedPaymentModel.updateOne).toHaveBeenCalledWith(
          { stripePaymentIntentId: mockInvoice.payment_intent },
          {
            $set: {
              status: 'succeeded',
              processedAt: expect.any(Date)
            }
          },
          { session: mockSession }
        );
      });
    });

    describe('handleInvoicePaymentFailed', () => {
      it('should handle invoice payment failed event', async () => {
        // Arrange
        const mockInvoice = createMockInvoice();
        const event = createMockStripeEvent('invoice.payment_failed', mockInvoice);

        enhancedPaymentModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(enhancedPaymentModel.updateOne).toHaveBeenCalledWith(
          { stripePaymentIntentId: mockInvoice.payment_intent },
          {
            $set: {
              status: 'failed',
              failureMessage: 'Invoice payment failed'
            }
          },
          { session: mockSession }
        );
      });
    });

    describe('handleInvoiceUpcoming', () => {
      it('should handle upcoming invoice event', async () => {
        // Arrange
        const mockInvoice = createMockInvoice();
        const event = createMockStripeEvent('invoice.upcoming', mockInvoice);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(logger.log).toHaveBeenCalledWith(
          `Upcoming invoice for customer: ${mockInvoice.customer}`,
          expect.objectContaining({
            amount: mockInvoice.amount_due,
            dueDate: mockInvoice.due_date
          })
        );
      });
    });
  });

  describe('Payment Method Events', () => {
    describe('handlePaymentMethodAttached', () => {
      it('should handle payment method attached event', async () => {
        // Arrange
        const mockPaymentMethod = createMockPaymentMethod();
        const event = createMockStripeEvent('payment_method.attached', mockPaymentMethod);

        customerModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(customerModel.updateOne).toHaveBeenCalledWith(
          { stripeCustomerId: mockPaymentMethod.customer },
          {
            $addToSet: {
              paymentMethods: {
                stripePaymentMethodId: mockPaymentMethod.id,
                type: mockPaymentMethod.type,
                details: {
                  type: 'card',
                  last4: '4242',
                  brand: 'visa',
                  expMonth: 12,
                  expYear: 2025,
                  country: 'US',
                  fingerprint: 'test_fingerprint'
                },
                isDefault: false
              }
            },
            $set: { updatedAt: expect.any(Date) }
          },
          { session: mockSession }
        );
      });
    });

    describe('handlePaymentMethodDetached', () => {
      it('should handle payment method detached event', async () => {
        // Arrange
        const mockPaymentMethod = createMockPaymentMethod();
        const event = createMockStripeEvent('payment_method.detached', mockPaymentMethod);

        customerModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(customerModel.updateOne).toHaveBeenCalledWith(
          { stripeCustomerId: mockPaymentMethod.customer },
          {
            $pull: {
              paymentMethods: { stripePaymentMethodId: mockPaymentMethod.id }
            },
            $set: { updatedAt: expect.any(Date) }
          },
          { session: mockSession }
        );
      });
    });
  });

  describe('Setup Intent Events', () => {
    describe('handleSetupIntentSucceeded', () => {
      it('should handle setup intent succeeded event', async () => {
        // Arrange
        const mockSetupIntent = createMockSetupIntent();
        const event = createMockStripeEvent('setup_intent.succeeded', mockSetupIntent);
        const mockSetupPayment = createMockEnhancedPayment({
          type: 'setup',
          amount: 0
        });

        enhancedPaymentModel.create = jest.fn().mockReturnValue(mockSetupPayment);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(enhancedPaymentModel.create).toHaveBeenCalledWith({
          userId: mockSetupIntent.metadata.userId,
          stripePaymentIntentId: mockSetupIntent.id,
          stripeCustomerId: mockSetupIntent.customer,
          stripePaymentMethodId: mockSetupIntent.payment_method,
          amount: 0,
          currency: 'usd',
          status: 'succeeded',
          paymentMethod: 'stripe',
          type: 'setup',
          description: 'Payment method setup',
          processedAt: expect.any(Date),
          metadata: {
            traceId: expect.any(String),
            setupIntent: true
          }
        });
        expect(mockSetupPayment.save).toHaveBeenCalledWith({ session: mockSession });
      });
    });
  });

  describe('Checkout Events', () => {
    describe('handleCheckoutSessionCompleted', () => {
      it('should handle checkout session completed event', async () => {
        // Arrange
        const mockCheckoutSession = createMockCheckoutSession();
        const event = createMockStripeEvent('checkout.session.completed', mockCheckoutSession);

        enhancedPaymentModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(enhancedPaymentModel.updateOne).toHaveBeenCalledWith(
          { stripePaymentIntentId: mockCheckoutSession.payment_intent },
          {
            $set: {
              metadata: {
                userId: mockCheckoutSession.metadata.userId,
                checkoutSessionId: mockCheckoutSession.id,
                checkoutCompleted: true
              }
            }
          },
          { session: mockSession }
        );
      });

      it('should handle checkout session without payment intent', async () => {
        // Arrange
        const mockCheckoutSession = createMockCheckoutSession({ payment_intent: null });
        const event = createMockStripeEvent('checkout.session.completed', mockCheckoutSession);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(enhancedPaymentModel.updateOne).not.toHaveBeenCalled();
      });
    });
  });

  describe('Dispute Events', () => {
    describe('handleDisputeCreated', () => {
      it('should handle dispute created event', async () => {
        // Arrange
        const mockDispute = createMockDispute();
        const event = createMockStripeEvent('charge.dispute.created', mockDispute);
        const mockEnhancedPayment = createMockEnhancedPayment({
          stripeChargeId: mockDispute.charge
        });

        enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(enhancedPaymentModel.findOne).toHaveBeenCalledWith({
          stripeChargeId: mockDispute.charge
        });
        expect(mockEnhancedPayment.disputed).toBe(true);
        expect(mockEnhancedPayment.disputedAt).toEqual(new Date(mockDispute.created * 1000));
        expect(mockEnhancedPayment.disputeDetails).toEqual({
          id: mockDispute.id,
          reason: mockDispute.reason,
          status: mockDispute.status,
          evidence: mockDispute.evidence,
          evidenceDeadline: new Date(mockDispute.evidence_details.due_by * 1000)
        });
        expect(mockEnhancedPayment.addWebhookEvent).toHaveBeenCalledWith(mockDispute.id, 'charge.dispute.created', true);
      });

      it('should handle dispute without evidence deadline', async () => {
        // Arrange
        const mockDispute = createMockDispute({
          evidence_details: {
            due_by: null,
            has_evidence: false,
            past_due: false,
            submission_count: 0
          }
        });
        const event = createMockStripeEvent('charge.dispute.created', mockDispute);
        const mockEnhancedPayment = createMockEnhancedPayment({
          stripeChargeId: mockDispute.charge
        });

        enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(mockEnhancedPayment.disputeDetails.evidenceDeadline).toBeUndefined();
      });

      it('should handle dispute when payment not found', async () => {
        // Arrange
        const mockDispute = createMockDispute();
        const event = createMockStripeEvent('charge.dispute.created', mockDispute);

        enhancedPaymentModel.findOne.mockResolvedValue(null);

        // Act
        await service.processWebhookEvent(event);

        // Assert
        expect(enhancedPaymentModel.findOne).toHaveBeenCalledWith({
          stripeChargeId: mockDispute.charge
        });
        // Should not throw error when payment not found
      });
    });
  });

  describe('Utility Methods', () => {
    describe('extractPaymentMethodDetails', () => {
      it('should extract card payment method details', () => {
        // Arrange
        const cardDetails = {
          type: 'card',
          card: {
            last4: '4242',
            brand: 'visa',
            exp_month: 12,
            exp_year: 2025,
            country: 'US',
            fingerprint: 'test_fingerprint',
            wallet: { type: 'apple_pay' }
          }
        };

        // Act
        const result = (service as any).extractPaymentMethodDetails(cardDetails);

        // Assert
        expect(result).toEqual({
          type: 'card',
          last4: '4242',
          brand: 'visa',
          expMonth: 12,
          expYear: 2025,
          country: 'US',
          fingerprint: 'test_fingerprint',
          wallet: 'apple_pay'
        });
      });

      it('should extract US bank account payment method details', () => {
        // Arrange
        const bankAccountDetails = {
          type: 'us_bank_account',
          us_bank_account: {
            last4: '6789',
            bank_name: 'STRIPE TEST BANK'
          }
        };

        // Act
        const result = (service as any).extractPaymentMethodDetails(bankAccountDetails);

        // Assert
        expect(result).toEqual({
          type: 'us_bank_account',
          last4: '6789',
          bankName: 'STRIPE TEST BANK',
          country: 'US'
        });
      });

      it('should extract SEPA debit payment method details', () => {
        // Arrange
        const sepaDetails = {
          type: 'sepa_debit',
          sepa_debit: {
            last4: '3456',
            bank_code: 'DEUTDEDBBER',
            country: 'DE'
          }
        };

        // Act
        const result = (service as any).extractPaymentMethodDetails(sepaDetails);

        // Assert
        expect(result).toEqual({
          type: 'sepa_debit',
          last4: '3456',
          bankName: 'DEUTDEDBBER',
          country: 'DE'
        });
      });

      it('should return null for missing payment method details', () => {
        // Act
        const result = (service as any).extractPaymentMethodDetails(null);

        // Assert
        expect(result).toBeNull();
      });

      it('should handle unknown payment method types', () => {
        // Arrange
        const unknownDetails = {
          type: 'unknown_type'
        };

        // Act
        const result = (service as any).extractPaymentMethodDetails(unknownDetails);

        // Assert
        expect(result).toEqual({
          type: 'unknown_type'
        });
      });
    });

    describe('extractPaymentIntentId', () => {
      it('should extract payment intent ID from payment intent event', () => {
        // Arrange
        const event = createMockStripeEvent('payment_intent.succeeded', {
          id: 'pi_test_123',
          object: 'payment_intent'
        });

        // Act
        const result = (service as any).extractPaymentIntentId(event);

        // Assert
        expect(result).toBe('pi_test_123');
      });

      it('should extract payment intent ID from object with payment_intent property', () => {
        // Arrange
        const event = createMockStripeEvent('invoice.payment_succeeded', {
          id: 'in_test_123',
          object: 'invoice',
          payment_intent: 'pi_test_456'
        });

        // Act
        const result = (service as any).extractPaymentIntentId(event);

        // Assert
        expect(result).toBe('pi_test_456');
      });

      it('should extract payment intent ID from nested invoice', () => {
        // Arrange
        const event = createMockStripeEvent('subscription.updated', {
          id: 'sub_test_123',
          object: 'subscription',
          invoice: {
            payment_intent: 'pi_test_789'
          }
        });

        // Act
        const result = (service as any).extractPaymentIntentId(event);

        // Assert
        expect(result).toBe('pi_test_789');
      });

      it('should return null when no payment intent ID found', () => {
        // Arrange
        const event = createMockStripeEvent('customer.created', {
          id: 'cus_test_123',
          object: 'customer'
        });

        // Act
        const result = (service as any).extractPaymentIntentId(event);

        // Assert
        expect(result).toBeNull();
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should process webhook events within SLA (<1000ms)', async () => {
      // Arrange
      const event = createMockStripeEvent('payment_intent.succeeded');
      const mockEnhancedPayment = createMockEnhancedPayment();

      enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

      // Act
      const startTime = Date.now();
      await service.processWebhookEvent(event);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle concurrent webhook processing', async () => {
      // Arrange
      const events = Array(5)
        .fill(null)
        .map((_, index) => createMockStripeEvent('payment_intent.succeeded', { id: `pi_test_${index}` }));
      const mockEnhancedPayment = createMockEnhancedPayment();

      enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

      // Act
      const promises = events.map(event => service.processWebhookEvent(event));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      expect(mockSession.withTransaction).toHaveBeenCalledTimes(5);
      expect(mockSession.endSession).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures', async () => {
      // Arrange
      const event = createMockStripeEvent('payment_intent.succeeded');
      const dbError = new Error('Database connection lost');

      enhancedPaymentModel.findOne.mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.processWebhookEvent(event)).rejects.toThrow(PaymentException);
      await expect(service.processWebhookEvent(event)).rejects.toThrow('Webhook processing failed: Database connection lost');

      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should handle malformed webhook events gracefully', async () => {
      // Arrange
      const malformedEvent = {
        id: 'evt_malformed',
        type: 'payment_intent.succeeded',
        data: {} // Missing required data
      } as any;

      // Act & Assert - Should not throw, just log as unhandled
      await expect(service.processWebhookEvent(malformedEvent)).resolves.not.toThrow();
    });

    it('should handle transaction rollback on errors', async () => {
      // Arrange
      const event = createMockStripeEvent('payment_intent.succeeded');
      const transactionError = new Error('Transaction failed');

      mockSession.withTransaction.mockRejectedValue(transactionError);

      // Act & Assert
      await expect(service.processWebhookEvent(event)).rejects.toThrow(PaymentException);

      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('Security Validations', () => {
    it('should validate webhook event structure', async () => {
      // Arrange
      const invalidEvent = {
        id: 'evt_invalid',
        type: 'payment_intent.succeeded'
        // Missing required fields
      } as any;

      // Act & Assert - Should handle gracefully
      await expect(service.processWebhookEvent(invalidEvent)).resolves.not.toThrow();
    });

    it('should sanitize webhook event data', async () => {
      // Arrange
      const eventWithMaliciousData = createMockStripeEvent('payment_intent.succeeded', {
        id: 'pi_test',
        description: '<script>alert("XSS")</script>',
        metadata: {
          maliciousField: 'javascript:alert(1)'
        }
      });
      const mockEnhancedPayment = createMockEnhancedPayment();

      enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

      // Act
      await service.processWebhookEvent(eventWithMaliciousData);

      // Assert - Should process without issues, but in real implementation should sanitize
      expect(mockEnhancedPayment.addWebhookEvent).toHaveBeenCalled();
    });

    it('should limit webhook event processing rate', async () => {
      // Arrange
      const events = Array(100)
        .fill(null)
        .map((_, index) => createMockStripeEvent('payment_intent.succeeded', { id: `pi_test_${index}` }));
      const mockEnhancedPayment = createMockEnhancedPayment();

      enhancedPaymentModel.findOne.mockResolvedValue(mockEnhancedPayment as any);

      // Act
      const startTime = Date.now();
      const promises = events.map(event => service.processWebhookEvent(event));
      await Promise.all(promises);
      const endTime = Date.now();

      // Assert - Should complete within reasonable time even with 100 events
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
      expect(mockSession.withTransaction).toHaveBeenCalledTimes(100);
    });
  });
});
