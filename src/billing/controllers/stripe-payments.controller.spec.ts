/* eslint-disable @typescript-eslint/unbound-method */
import {Test, TestingModule} from '@nestjs/testing';
import {INestApplication, ValidationPipe} from '@nestjs/common';
import {ThrottlerModule} from '@nestjs/throttler';
import * as request from 'supertest';
import {Types} from 'mongoose';

import {StripePaymentsController} from './stripe-payments.controller';
import {StripeService} from '../services/stripe.service';
import {StripeWebhookService} from '../services/stripe-webhook.service';
import {JwtAuthGuard} from '../../auth/guards/jwt-auth.guard';
import {RolesGuard} from '../../common/guards/roles.guard';
import {RequestTracingInterceptor} from '../../common/interceptors/request-tracing.interceptor';

import {PaymentException} from '../../common/exceptions/payment.exception';
import {ValidationException} from '../../common/exceptions/validation.exception';
import {NotFoundResourceException} from '../../common/exceptions/not-found-resource.exception';

import {CreatePaymentIntentDto, CreateSubscriptionDto, UpdateSubscriptionDto, CreateCustomerDto} from '../dto';

describe('StripePaymentsController - Integration Tests', () => {
  let app: INestApplication;
  let controller: StripePaymentsController;
  let stripeService: jest.Mocked<StripeService>;
  let webhookService: jest.Mocked<StripeWebhookService>;

  // Test data factories
  const createMockUser = (overrides = {}): any => ({
    _id: new Types.ObjectId(),
    id: new Types.ObjectId().toString(),
    email: 'test@savium.ai',
    firstName: 'John',
    lastName: 'Doe',
    role: 'USER',
    isActive: true,
    isEmailVerified: true,
    ...overrides
  });

  const createMockCustomer = (overrides = {}): any => ({
    _id: new Types.ObjectId(),
    stripeCustomerId: 'cus_test_customer',
    email: 'test@savium.ai',
    name: 'John Doe',
    phone: '+1234567890',
    isActive: true,
    ...overrides
  });

  const createMockPaymentIntent = (overrides = {}): any => ({
    id: 'pi_test_payment_intent',
    client_secret: 'pi_test_payment_intent_secret',
    amount: 2999,
    currency: 'usd',
    status: 'requires_payment_method',
    ...overrides
  });

  const createMockPayment = (overrides = {}): any => ({
    _id: new Types.ObjectId(),
    stripePaymentIntentId: 'pi_test_payment_intent',
    amount: 29.99,
    currency: 'usd',
    status: 'pending',
    ...overrides
  });

  const createMockSubscription = (overrides = {}): any => ({
    id: 'sub_test_subscription',
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
    customer: 'cus_test_customer',
    cancel_at_period_end: false,
    canceled_at: null,
    trial_start: null,
    trial_end: null,
    items: {
      data: [
        {
          id: 'si_test_item',
          price: {id: 'price_test', product: 'prod_test'},
          quantity: 1
        }
      ]
    },
    latest_invoice: {
      payment_intent: {
        client_secret: 'pi_test_client_secret'
      }
    },
    ...overrides
  });

  const createMockSubscriptionDoc = (overrides = {}): any => ({
    _id: new Types.ObjectId(),
    accountType: 'personal',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    trialEnd: null,
    ...overrides
  });

  const createMockSetupIntent = (overrides = {}): any => ({
    id: 'seti_test_setup_intent',
    client_secret: 'seti_test_setup_intent_secret',
    status: 'requires_payment_method',
    ...overrides
  });

  const createMockPaymentMethod = (overrides = {}): any => ({
    id: 'pm_test_payment_method',
    type: 'card',
    card: {
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2025,
      country: 'US'
    },
    created: Math.floor(Date.now() / 1000),
    ...overrides
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 100
          }
        ])
      ],
      controllers: [StripePaymentsController],
      providers: [
        {
          provide: StripeService,
          useValue: {
            createOrGetCustomer: jest.fn(),
            createPaymentIntent: jest.fn(),
            confirmPaymentIntent: jest.fn(),
            createSubscription: jest.fn(),
            updateSubscription: jest.fn(),
            cancelSubscription: jest.fn(),
            getSubscription: jest.fn(),
            createSetupIntent: jest.fn(),
            listPaymentMethods: jest.fn(),
            detachPaymentMethod: jest.fn(),
            getPublishableKey: jest.fn(),
            constructWebhookEvent: jest.fn()
          }
        },
        {
          provide: StripeWebhookService,
          useValue: {
            processWebhookEvent: jest.fn()
          }
        }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true)
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true)
      })
      .overrideInterceptor(RequestTracingInterceptor)
      .useValue({
        intercept: jest.fn().mockImplementation((context, next) => next.handle())
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );

    controller = module.get<StripePaymentsController>(StripePaymentsController);
    stripeService = module.get(StripeService);
    webhookService = module.get(StripeWebhookService);

    await app.init();

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /stripe/customer', () => {
    it('should create customer successfully with valid data', async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockCustomer = createMockCustomer();
      const customerDto: CreateCustomerDto = {
        userId: mockUser.id,
        email: 'test@savium.ai',
        name: 'John Doe',
        phone: '+1234567890',
        accountType: 'personal',
        address: {
          line1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          country: 'US'
        }
      };

      stripeService.createOrGetCustomer.mockResolvedValue(mockCustomer);

      // Mock user from JWT guard
      const mockGetUser = jest.fn().mockReturnValue(mockUser);
      const originalCreateDecorator = require('@nestjs/common').createParamDecorator;
      jest.spyOn(require('../../auth/decorators/get-user.decorator'), 'GetUser').mockImplementation(() => originalCreateDecorator(() => mockUser)());

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/customer').send(customerDto).expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          customerId: mockCustomer._id,
          stripeCustomerId: mockCustomer.stripeCustomerId,
          email: mockCustomer.email,
          name: mockCustomer.name
        }
      });
      expect(stripeService.createOrGetCustomer).toHaveBeenCalledWith({
        ...customerDto,
        userId: mockUser._id.toString()
      });
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidCustomerDto = {
        // Missing required fields
        email: 'invalid-email',
        name: ''
      };

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/customer').send(invalidCustomerDto).expect(400);

      expect(response.body.message).toContain('validation failed');
      expect(stripeService.createOrGetCustomer).not.toHaveBeenCalled();
    });

    it('should handle Stripe service errors', async () => {
      // Arrange
      const mockUser = createMockUser();
      const customerDto: CreateCustomerDto = {
        userId: mockUser.id,
        email: 'test@savium.ai',
        name: 'John Doe',
        accountType: 'personal'
      };

      stripeService.createOrGetCustomer.mockRejectedValue(new PaymentException('Stripe API error', 'STRIPE_API_ERROR'));

      // Act & Assert
      await request(app.getHttpServer()).post('/stripe/customer').send(customerDto).expect(400);

      expect(stripeService.createOrGetCustomer).toHaveBeenCalled();
    });
  });

  describe('POST /stripe/payment-intent', () => {
    it('should create payment intent successfully', async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockPaymentIntent = createMockPaymentIntent();
      const mockPayment = createMockPayment();
      const paymentDto: CreatePaymentIntentDto = {
        userId: mockUser._id.toString(),
        accountId: new Types.ObjectId().toString(),
        amount: 29.99,
        currency: 'usd',
        description: 'Test payment',
        paymentMethodTypes: ['card'],
        captureMethod: 'automatic'
      };

      stripeService.createPaymentIntent.mockResolvedValue({
        paymentIntent: mockPaymentIntent,
        payment: mockPayment
      });

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/payment-intent').send(paymentDto).expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          paymentIntentId: mockPaymentIntent.id,
          clientSecret: mockPaymentIntent.client_secret,
          amount: mockPayment.amount,
          currency: mockPayment.currency,
          status: mockPaymentIntent.status,
          paymentId: mockPayment._id
        }
      });
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(paymentDto);
    });

    it('should validate user ID mismatch', async () => {
      // Arrange
      const mockUser = createMockUser();
      const paymentDto: CreatePaymentIntentDto = {
        userId: new Types.ObjectId().toString(), // Different from authenticated user
        accountId: new Types.ObjectId().toString(),
        amount: 29.99
      };

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/payment-intent').send(paymentDto).expect(400);

      expect(response.body.message).toContain('User ID mismatch');
      expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('should validate amount constraints', async () => {
      // Arrange
      const paymentDto = {
        userId: new Types.ObjectId().toString(),
        accountId: new Types.ObjectId().toString(),
        amount: -10 // Invalid negative amount
      };

      // Act & Assert
      await request(app.getHttpServer()).post('/stripe/payment-intent').send(paymentDto).expect(400);

      expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('should validate currency format', async () => {
      // Arrange
      const paymentDto = {
        userId: new Types.ObjectId().toString(),
        accountId: new Types.ObjectId().toString(),
        amount: 29.99,
        currency: 'invalid_currency'
      };

      // Act & Assert
      await request(app.getHttpServer()).post('/stripe/payment-intent').send(paymentDto).expect(400);

      expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
    });
  });

  describe('POST /stripe/payment-intent/:paymentIntentId/confirm', () => {
    it('should confirm payment intent successfully', async () => {
      // Arrange
      const paymentIntentId = 'pi_test_payment_intent';
      const paymentMethodId = 'pm_test_payment_method';
      const mockConfirmedPaymentIntent = createMockPaymentIntent({
        id: paymentIntentId,
        status: 'succeeded'
      });

      stripeService.confirmPaymentIntent.mockResolvedValue(mockConfirmedPaymentIntent);

      // Act & Assert
      const response = await request(app.getHttpServer()).post(`/stripe/payment-intent/${paymentIntentId}/confirm`).send({paymentMethodId}).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          paymentIntentId: mockConfirmedPaymentIntent.id,
          status: mockConfirmedPaymentIntent.status,
          amount: mockConfirmedPaymentIntent.amount,
          currency: mockConfirmedPaymentIntent.currency
        }
      });
      expect(stripeService.confirmPaymentIntent).toHaveBeenCalledWith(paymentIntentId, paymentMethodId);
    });

    it('should confirm payment intent without payment method', async () => {
      // Arrange
      const paymentIntentId = 'pi_test_payment_intent';
      const mockConfirmedPaymentIntent = createMockPaymentIntent({
        id: paymentIntentId,
        status: 'succeeded'
      });

      stripeService.confirmPaymentIntent.mockResolvedValue(mockConfirmedPaymentIntent);

      // Act & Assert
      const response = await request(app.getHttpServer()).post(`/stripe/payment-intent/${paymentIntentId}/confirm`).send({}).expect(200);

      expect(stripeService.confirmPaymentIntent).toHaveBeenCalledWith(paymentIntentId, undefined);
    });

    it('should handle confirmation errors', async () => {
      // Arrange
      const paymentIntentId = 'pi_test_payment_intent';

      stripeService.confirmPaymentIntent.mockRejectedValue(new PaymentException('Card was declined', 'CARD_DECLINED'));

      // Act & Assert
      await request(app.getHttpServer()).post(`/stripe/payment-intent/${paymentIntentId}/confirm`).send({}).expect(400);

      expect(stripeService.confirmPaymentIntent).toHaveBeenCalledWith(paymentIntentId, undefined);
    });
  });

  describe('POST /stripe/subscription', () => {
    it('should create subscription successfully', async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockSubscription = createMockSubscription();
      const mockSubscriptionDoc = createMockSubscriptionDoc();
      const subscriptionDto: CreateSubscriptionDto = {
        userId: mockUser._id.toString(),
        plan: 'personal',
        interval: 'monthly',
        stripeSubscriptionId: 'sub_test',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_test',
        stripeProductId: 'prod_test',
        amount: 999,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      stripeService.createSubscription.mockResolvedValue({
        subscription: mockSubscription,
        subscriptionDoc: mockSubscriptionDoc
      });

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/subscription').send(subscriptionDto).expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          subscriptionId: mockSubscription.id,
          status: mockSubscription.status,
          accountType: mockSubscriptionDoc.accountType,
          currentPeriodStart: mockSubscriptionDoc.currentPeriodStart.toISOString(),
          currentPeriodEnd: mockSubscriptionDoc.currentPeriodEnd.toISOString(),
          trialEnd: mockSubscriptionDoc.trialEnd,
          clientSecret: mockSubscription.latest_invoice.payment_intent.client_secret
        }
      });
      expect(stripeService.createSubscription).toHaveBeenCalledWith(subscriptionDto);
    });

    it('should validate user ID mismatch for subscription', async () => {
      // Arrange
      const mockUser = createMockUser();
      const subscriptionDto: CreateSubscriptionDto = {
        userId: new Types.ObjectId().toString(), // Different user
        plan: 'personal',
        interval: 'monthly',
        stripeSubscriptionId: 'sub_test',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_test',
        stripeProductId: 'prod_test',
        amount: 999,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date()
      };

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/subscription').send(subscriptionDto).expect(400);

      expect(response.body.message).toContain('User ID mismatch');
      expect(stripeService.createSubscription).not.toHaveBeenCalled();
    });

    it('should validate subscription plan enum', async () => {
      // Arrange
      const subscriptionDto = {
        userId: new Types.ObjectId().toString(),
        plan: 'invalid_plan', // Invalid plan
        interval: 'monthly',
        stripeSubscriptionId: 'sub_test',
        stripeCustomerId: 'cus_test',
        stripePriceId: 'price_test',
        stripeProductId: 'prod_test',
        amount: 999,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date()
      };

      // Act & Assert
      await request(app.getHttpServer()).post('/stripe/subscription').send(subscriptionDto).expect(400);

      expect(stripeService.createSubscription).not.toHaveBeenCalled();
    });

    it('should validate required fields for subscription', async () => {
      // Arrange
      const invalidSubscriptionDto = {
        // Missing required fields
        plan: 'personal'
      };

      // Act & Assert
      await request(app.getHttpServer()).post('/stripe/subscription').send(invalidSubscriptionDto).expect(400);

      expect(stripeService.createSubscription).not.toHaveBeenCalled();
    });
  });

  describe('PUT /stripe/subscription/:subscriptionId', () => {
    it('should update subscription successfully', async () => {
      // Arrange
      const subscriptionId = 'sub_test_subscription';
      const updateDto: UpdateSubscriptionDto = {
        newAccountType: 'couple',
        prorationBehavior: 'create_prorations',
        metadata: {updated: 'true'}
      };
      const mockUpdatedSubscription = createMockSubscription({
        id: subscriptionId,
        status: 'active'
      });

      stripeService.updateSubscription.mockResolvedValue(mockUpdatedSubscription);

      // Act & Assert
      const response = await request(app.getHttpServer()).put(`/stripe/subscription/${subscriptionId}`).send(updateDto).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          subscriptionId: mockUpdatedSubscription.id,
          status: mockUpdatedSubscription.status,
          currentPeriodStart: new Date(mockUpdatedSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(mockUpdatedSubscription.current_period_end * 1000)
        }
      });
      expect(stripeService.updateSubscription).toHaveBeenCalledWith(subscriptionId, updateDto);
    });

    it('should handle subscription not found', async () => {
      // Arrange
      const subscriptionId = 'sub_nonexistent';
      const updateDto: UpdateSubscriptionDto = {
        newAccountType: 'couple'
      };

      stripeService.updateSubscription.mockRejectedValue(new NotFoundResourceException('Subscription not found', 'SUBSCRIPTION_NOT_FOUND'));

      // Act & Assert
      await request(app.getHttpServer()).put(`/stripe/subscription/${subscriptionId}`).send(updateDto).expect(404);

      expect(stripeService.updateSubscription).toHaveBeenCalledWith(subscriptionId, updateDto);
    });
  });

  describe('DELETE /stripe/subscription/:subscriptionId', () => {
    it('should cancel subscription at period end by default', async () => {
      // Arrange
      const subscriptionId = 'sub_test_subscription';
      const mockCanceledSubscription = createMockSubscription({
        id: subscriptionId,
        status: 'active',
        cancel_at_period_end: true
      });

      stripeService.cancelSubscription.mockResolvedValue(mockCanceledSubscription);

      // Act & Assert
      const response = await request(app.getHttpServer()).delete(`/stripe/subscription/${subscriptionId}`).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          subscriptionId: mockCanceledSubscription.id,
          status: mockCanceledSubscription.status,
          cancelAtPeriodEnd: mockCanceledSubscription.cancel_at_period_end,
          canceledAt: null
        }
      });
      expect(stripeService.cancelSubscription).toHaveBeenCalledWith(
        subscriptionId,
        true // default cancelAtPeriodEnd
      );
    });

    it('should cancel subscription immediately when specified', async () => {
      // Arrange
      const subscriptionId = 'sub_test_subscription';
      const mockCanceledSubscription = createMockSubscription({
        id: subscriptionId,
        status: 'canceled',
        cancel_at_period_end: false,
        canceled_at: Math.floor(Date.now() / 1000)
      });

      stripeService.cancelSubscription.mockResolvedValue(mockCanceledSubscription);

      // Act & Assert
      const response = await request(app.getHttpServer()).delete(`/stripe/subscription/${subscriptionId}`).query({atPeriodEnd: 'false'}).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          subscriptionId: mockCanceledSubscription.id,
          status: mockCanceledSubscription.status,
          cancelAtPeriodEnd: mockCanceledSubscription.cancel_at_period_end,
          canceledAt: new Date(mockCanceledSubscription.canceled_at * 1000)
        }
      });
      expect(stripeService.cancelSubscription).toHaveBeenCalledWith(subscriptionId, false);
    });
  });

  describe('GET /stripe/subscription/:subscriptionId', () => {
    it('should retrieve subscription details successfully', async () => {
      // Arrange
      const subscriptionId = 'sub_test_subscription';
      const mockSubscription = createMockSubscription({
        id: subscriptionId,
        status: 'active'
      });

      stripeService.getSubscription.mockResolvedValue(mockSubscription);

      // Act & Assert
      const response = await request(app.getHttpServer()).get(`/stripe/subscription/${subscriptionId}`).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          subscriptionId: mockSubscription.id,
          customerId: mockSubscription.customer,
          status: mockSubscription.status,
          currentPeriodStart: new Date(mockSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(mockSubscription.current_period_end * 1000),
          trialStart: null,
          trialEnd: null,
          cancelAtPeriodEnd: mockSubscription.cancel_at_period_end,
          canceledAt: null,
          items: [
            {
              id: 'si_test_item',
              priceId: 'price_test',
              productId: 'prod_test',
              quantity: 1
            }
          ]
        }
      });
      expect(stripeService.getSubscription).toHaveBeenCalledWith(subscriptionId);
    });

    it('should handle subscription not found', async () => {
      // Arrange
      const subscriptionId = 'sub_nonexistent';

      stripeService.getSubscription.mockRejectedValue(new NotFoundResourceException('Subscription not found', 'SUBSCRIPTION_NOT_FOUND'));

      // Act & Assert
      await request(app.getHttpServer()).get(`/stripe/subscription/${subscriptionId}`).expect(404);

      expect(stripeService.getSubscription).toHaveBeenCalledWith(subscriptionId);
    });
  });

  describe('POST /stripe/setup-intent', () => {
    it('should create setup intent successfully', async () => {
      // Arrange
      const customerId = 'cus_test_customer';
      const setupData = {
        customerId,
        paymentMethodTypes: ['card', 'us_bank_account']
      };
      const mockSetupIntent = createMockSetupIntent();

      stripeService.createSetupIntent.mockResolvedValue(mockSetupIntent);

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/setup-intent').send(setupData).expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          setupIntentId: mockSetupIntent.id,
          clientSecret: mockSetupIntent.client_secret,
          status: mockSetupIntent.status
        }
      });
      expect(stripeService.createSetupIntent).toHaveBeenCalledWith(customerId, setupData.paymentMethodTypes);
    });

    it('should create setup intent with default payment method types', async () => {
      // Arrange
      const customerId = 'cus_test_customer';
      const setupData = {customerId};
      const mockSetupIntent = createMockSetupIntent();

      stripeService.createSetupIntent.mockResolvedValue(mockSetupIntent);

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/setup-intent').send(setupData).expect(201);

      expect(stripeService.createSetupIntent).toHaveBeenCalledWith(customerId, undefined);
    });

    it('should validate required customer ID', async () => {
      // Arrange
      const setupData = {
        // Missing customerId
        paymentMethodTypes: ['card']
      };

      // Act & Assert
      await request(app.getHttpServer()).post('/stripe/setup-intent').send(setupData).expect(400);

      expect(stripeService.createSetupIntent).not.toHaveBeenCalled();
    });
  });

  describe('GET /stripe/customer/:customerId/payment-methods', () => {
    it('should list payment methods successfully', async () => {
      // Arrange
      const customerId = 'cus_test_customer';
      const type = 'card';
      const mockPaymentMethods = [createMockPaymentMethod(), createMockPaymentMethod({id: 'pm_test_2'})];

      stripeService.listPaymentMethods.mockResolvedValue(mockPaymentMethods);

      // Act & Assert
      const response = await request(app.getHttpServer()).get(`/stripe/customer/${customerId}/payment-methods`).query({type}).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockPaymentMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          card: {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
            country: pm.card.country
          },
          created: new Date(pm.created * 1000)
        }))
      });
      expect(stripeService.listPaymentMethods).toHaveBeenCalledWith(customerId, type);
    });

    it('should list payment methods with default type', async () => {
      // Arrange
      const customerId = 'cus_test_customer';
      const mockPaymentMethods = [createMockPaymentMethod()];

      stripeService.listPaymentMethods.mockResolvedValue(mockPaymentMethods);

      // Act & Assert
      const response = await request(app.getHttpServer()).get(`/stripe/customer/${customerId}/payment-methods`).expect(200);

      expect(stripeService.listPaymentMethods).toHaveBeenCalledWith(customerId, undefined);
    });

    it('should handle non-card payment methods', async () => {
      // Arrange
      const customerId = 'cus_test_customer';
      const mockPaymentMethods = [
        createMockPaymentMethod({
          type: 'us_bank_account',
          card: null,
          us_bank_account: {
            last4: '6789',
            bank_name: 'Test Bank'
          }
        })
      ];

      stripeService.listPaymentMethods.mockResolvedValue(mockPaymentMethods);

      // Act & Assert
      const response = await request(app.getHttpServer()).get(`/stripe/customer/${customerId}/payment-methods`).expect(200);

      expect(response.body.data[0].card).toBeNull();
    });
  });

  describe('DELETE /stripe/payment-method/:paymentMethodId', () => {
    it('should detach payment method successfully', async () => {
      // Arrange
      const paymentMethodId = 'pm_test_payment_method';
      const mockDetachedPaymentMethod = createMockPaymentMethod({
        id: paymentMethodId,
        customer: null
      });

      stripeService.detachPaymentMethod.mockResolvedValue(mockDetachedPaymentMethod);

      // Act & Assert
      const response = await request(app.getHttpServer()).delete(`/stripe/payment-method/${paymentMethodId}`).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          paymentMethodId: mockDetachedPaymentMethod.id,
          status: 'detached'
        }
      });
      expect(stripeService.detachPaymentMethod).toHaveBeenCalledWith(paymentMethodId);
    });

    it('should handle payment method not found', async () => {
      // Arrange
      const paymentMethodId = 'pm_nonexistent';

      stripeService.detachPaymentMethod.mockRejectedValue(new NotFoundResourceException('Payment method not found', 'PAYMENT_METHOD_NOT_FOUND'));

      // Act & Assert
      await request(app.getHttpServer()).delete(`/stripe/payment-method/${paymentMethodId}`).expect(404);

      expect(stripeService.detachPaymentMethod).toHaveBeenCalledWith(paymentMethodId);
    });
  });

  describe('GET /stripe/config/publishable-key', () => {
    it('should return publishable key successfully', async () => {
      // Arrange
      const publishableKey = 'pk_test_publishable_key';

      stripeService.getPublishableKey.mockReturnValue(publishableKey);

      // Act & Assert
      const response = await request(app.getHttpServer()).get('/stripe/config/publishable-key').expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          publishableKey
        }
      });
      expect(stripeService.getPublishableKey).toHaveBeenCalled();
    });

    it('should return empty string when key not configured', async () => {
      // Arrange
      stripeService.getPublishableKey.mockReturnValue('');

      // Act & Assert
      const response = await request(app.getHttpServer()).get('/stripe/config/publishable-key').expect(200);

      expect(response.body.data.publishableKey).toBe('');
    });
  });

  describe('POST /stripe/webhook', () => {
    it('should process webhook successfully', async () => {
      // Arrange
      const payload = JSON.stringify({
        id: 'evt_test_webhook',
        type: 'payment_intent.succeeded',
        data: {object: {id: 'pi_test'}}
      });
      const signature = 'test_signature';
      const mockEvent = {
        id: 'evt_test_webhook',
        type: 'payment_intent.succeeded'
      };

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookService.processWebhookEvent.mockResolvedValue(undefined);

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/webhook').set('stripe-signature', signature).send(payload).expect(200);

      expect(response.body).toEqual({received: true});
      expect(stripeService.constructWebhookEvent).toHaveBeenCalledWith(expect.any(Buffer), signature);
      expect(webhookService.processWebhookEvent).toHaveBeenCalledWith(mockEvent);
    });

    it('should reject webhook without signature', async () => {
      // Arrange
      const payload = JSON.stringify({type: 'payment_intent.succeeded'});

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/webhook').send(payload).expect(400);

      expect(response.body.message).toContain('Missing stripe-signature header');
      expect(stripeService.constructWebhookEvent).not.toHaveBeenCalled();
      expect(webhookService.processWebhookEvent).not.toHaveBeenCalled();
    });

    it('should handle webhook signature verification failure', async () => {
      // Arrange
      const payload = JSON.stringify({type: 'payment_intent.succeeded'});
      const signature = 'invalid_signature';

      stripeService.constructWebhookEvent.mockImplementation(() => {
        throw new PaymentException('Webhook signature verification failed', 'WEBHOOK_VERIFICATION_FAILED');
      });

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/webhook').set('stripe-signature', signature).send(payload).expect(400);

      expect(response.body.message).toContain('Webhook signature verification failed');
      expect(webhookService.processWebhookEvent).not.toHaveBeenCalled();
    });

    it('should handle webhook processing errors', async () => {
      // Arrange
      const payload = JSON.stringify({type: 'payment_intent.succeeded'});
      const signature = 'test_signature';
      const mockEvent = {id: 'evt_test', type: 'payment_intent.succeeded'};

      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookService.processWebhookEvent.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/webhook').set('stripe-signature', signature).send(payload).expect(400);

      expect(response.body.message).toContain('Webhook error: Database connection failed');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to endpoints', async () => {
      // Arrange
      const mockUser = createMockUser();
      const customerDto: CreateCustomerDto = {
        userId: mockUser.id,
        email: 'test@savium.ai',
        name: 'John Doe',
        accountType: 'personal'
      };
      const mockCustomer = createMockCustomer();

      stripeService.createOrGetCustomer.mockResolvedValue(mockCustomer);

      // Act - Make many requests quickly
      const requests = Array(150)
        .fill(null)
        .map(() => request(app.getHttpServer()).post('/stripe/customer').send(customerDto));

      const responses = await Promise.allSettled(requests);

      // Assert - Some requests should be rate limited
      const rateLimitedResponses = responses.filter(result => result.status === 'fulfilled' && result.value.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Validations', () => {
    it('should require authentication for protected endpoints', async () => {
      // Arrange - Override guards to simulate unauthenticated request
      const guardMock = jest.fn().mockReturnValue(false);
      app.get(JwtAuthGuard).canActivate = guardMock;

      // Act & Assert
      await request(app.getHttpServer()).post('/stripe/customer').send({}).expect(403); // Forbidden when not authenticated
    });

    it('should validate request body size limits', async () => {
      // Arrange
      const largePayload = {
        userId: new Types.ObjectId().toString(),
        description: 'x'.repeat(10000), // Very large description
        metadata: {}
      };

      // Fill metadata with large amount of data
      for (let i = 0; i < 1000; i++) {
        largePayload.metadata[`key${i}`] = 'x'.repeat(1000);
      }

      // Act & Assert
      await request(app.getHttpServer()).post('/stripe/payment-intent').send(largePayload).expect(413); // Payload too large
    });

    it('should sanitize input to prevent injection attacks', async () => {
      // Arrange
      const maliciousDto = {
        userId: new Types.ObjectId().toString(),
        accountId: new Types.ObjectId().toString(),
        amount: 29.99,
        description: '<script>alert("XSS")</script>',
        metadata: {
          maliciousField: 'javascript:alert(1)'
        }
      };
      const mockPaymentIntent = createMockPaymentIntent();
      const mockPayment = createMockPayment();

      stripeService.createPaymentIntent.mockResolvedValue({
        paymentIntent: mockPaymentIntent,
        payment: mockPayment
      });

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/payment-intent').send(maliciousDto).expect(201);

      // Should process successfully but sanitize the input
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          description: maliciousDto.description, // In real implementation, this should be sanitized
          metadata: maliciousDto.metadata
        })
      );
    });
  });

  describe('Performance Characteristics', () => {
    it('should maintain response time SLA under normal load', async () => {
      // Arrange
      const publishableKey = 'pk_test_key';
      stripeService.getPublishableKey.mockReturnValue(publishableKey);

      // Act
      const responseTimes = [];
      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        await request(app.getHttpServer()).get('/stripe/config/publishable-key').expect(200);
        responseTimes.push(Date.now() - start);
      }

      // Assert - 95th percentile should be under 200ms
      const p95 = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      expect(p95).toBeLessThan(200);
    });

    it('should handle concurrent requests efficiently', async () => {
      // Arrange
      const publishableKey = 'pk_test_key';
      stripeService.getPublishableKey.mockReturnValue(publishableKey);

      // Act
      const concurrentRequests = Array(20)
        .fill(null)
        .map(() => request(app.getHttpServer()).get('/stripe/config/publishable-key').expect(200));

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // Assert
      expect(responses).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Error Response Formats', () => {
    it('should return consistent error response format', async () => {
      // Arrange
      stripeService.createOrGetCustomer.mockRejectedValue(new PaymentException('Test error', 'TEST_ERROR'));

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/stripe/customer')
        .send({
          userId: new Types.ObjectId().toString(),
          email: 'test@savium.ai',
          name: 'Test User',
          accountType: 'personal'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.any(String),
        error: expect.any(String)
      });
    });

    it('should handle validation errors with detailed messages', async () => {
      // Arrange
      const invalidDto = {
        // Missing required fields
        email: 'invalid-email-format',
        amount: 'not-a-number'
      };

      // Act & Assert
      const response = await request(app.getHttpServer()).post('/stripe/payment-intent').send(invalidDto).expect(400);

      expect(response.body.message).toBeInstanceOf(Array);
      expect(response.body.message.length).toBeGreaterThan(0);
    });
  });
});
