import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {InjectModel} from '@nestjs/mongoose';
import {Model, ClientSession} from 'mongoose';
import Stripe from 'stripe';
import {v4 as uuidv4} from 'uuid';

import {Payment, PaymentDocument} from '../schemas/payment.schema';
import {Subscription, SubscriptionDocument} from '../schemas/subscription.schema';
import {BillingCustomer, BillingCustomerDocument} from '../schemas/billing-customer.schema';

import {PaymentException} from '../../common/exceptions/payment.exception';
import {NotFoundResourceException} from '../../common/exceptions/not-found-resource.exception';
import {ValidationException} from '../../common/exceptions/validation.exception';

import {CreatePaymentIntentDto, CreateSubscriptionDto, UpdateSubscriptionDto, CreateCustomerDto} from '../dto';

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(BillingCustomer.name) private customerModel: Model<BillingCustomerDocument>
  ) {}

  onModuleInit() {
    const secretKey = this.configService.get<string>('stripe.secretKey');
    const apiVersion = this.configService.get<string>('stripe.apiVersion');

    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured - Stripe functionality will be disabled');
      return;
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: apiVersion as Stripe.LatestApiVersion,
      maxNetworkRetries: this.configService.get<number>('stripe.rateLimiting.maxRetries', 3),
      timeout: this.configService.get<number>('stripe.rateLimiting.retryDelay', 30000),
      telemetry: false,
      appInfo: {
        name: 'Savium Finance Backend',
        version: '1.0.0'
      }
    });

    this.logger.log('Stripe service initialized successfully');
  }

  private ensureStripeInitialized(): void {
    if (!this.stripe) {
      throw new PaymentException('Stripe service not configured', 'STRIPE_NOT_CONFIGURED');
    }
  }

  /**
   * Create or retrieve Stripe customer
   */
  async createOrGetCustomer(createCustomerDto: CreateCustomerDto, session?: ClientSession): Promise<BillingCustomerDocument> {
    this.ensureStripeInitialized();

    const traceId = uuidv4();
    this.logger.log(`Creating/retrieving customer`, {traceId, userId: createCustomerDto.userId});

    try {
      // Check if customer already exists in our database
      let customer = await this.customerModel.findOne({userId: createCustomerDto.userId}).session(session || null);

      if (customer && customer.stripeCustomerId) {
        // Verify customer exists in Stripe
        try {
          const stripeCustomer = await this.stripe.customers.retrieve(customer.stripeCustomerId);
          if (!stripeCustomer.deleted) {
            this.logger.log(`Existing customer found`, {traceId, customerId: customer.stripeCustomerId});
            return customer;
          }
        } catch (error) {
          this.logger.warn(`Stripe customer not found, creating new one`, {traceId, error: error.message});
        }
      }

      // Create new Stripe customer
      const stripeCustomer = await this.stripe.customers.create({
        email: createCustomerDto.email,
        name: createCustomerDto.name,
        phone: createCustomerDto.phone,
        address: createCustomerDto.address,
        metadata: {
          userId: createCustomerDto.userId,
          accountType: (createCustomerDto as any).accountType,
          traceId
        }
      });

      // Create or update customer in database
      if (customer) {
        customer.stripeCustomerId = stripeCustomer.id;
        customer.email = createCustomerDto.email;
        customer.name = createCustomerDto.name;
        customer.phone = createCustomerDto.phone;
        customer.address = createCustomerDto.address;
        customer.updatedAt = new Date();
        await customer.save({session});
      } else {
        customer = new this.customerModel({
          userId: createCustomerDto.userId,
          stripeCustomerId: stripeCustomer.id,
          email: createCustomerDto.email,
          name: createCustomerDto.name,
          phone: createCustomerDto.phone,
          address: createCustomerDto.address,
          accountType: (createCustomerDto as any).accountType,
          isActive: true
        });
        await customer.save({session});
      }

      this.logger.log(`Customer created successfully`, {
        traceId,
        customerId: stripeCustomer.id,
        userId: createCustomerDto.userId
      });

      return customer;
    } catch (error) {
      this.logger.error(`Failed to create customer`, {
        traceId,
        error: error.message,
        userId: createCustomerDto.userId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentException(`Stripe error: ${error.message}`, 'STRIPE_API_ERROR');
      }
      throw error;
    }
  }

  /**
   * Create payment intent for one-time payments
   */
  async createPaymentIntent(
    createPaymentDto: CreatePaymentIntentDto,
    session?: ClientSession
  ): Promise<{paymentIntent: Stripe.PaymentIntent; payment: PaymentDocument}> {
    this.ensureStripeInitialized();

    const traceId = uuidv4();
    this.logger.log(`Creating payment intent`, {traceId, ...createPaymentDto});

    try {
      // Validate required fields
      if (!createPaymentDto.userId) {
        throw new ValidationException('User ID is required', 'USER_ID_REQUIRED');
      }

      // Get customer
      const customer = await this.customerModel.findOne({userId: createPaymentDto.userId}).session(session || null);
      if (!customer) {
        throw new NotFoundResourceException('Customer not found', 'USER_NOT_FOUND');
      }

      // Validate amount
      if (createPaymentDto.amount <= 0) {
        throw new ValidationException('Amount must be greater than 0', 'INVALID_AMOUNT');
      }

      const currency = createPaymentDto.currency || this.configService.get<string>('stripe.defaultCurrency');

      // Create payment intent in Stripe
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(createPaymentDto.amount * 100), // Convert to cents
        currency: currency!,
        customer: customer.stripeCustomerId,
        description: createPaymentDto.description,
        payment_method_types: createPaymentDto.paymentMethodTypes || ['card'],
        capture_method: createPaymentDto.captureMethod || 'automatic',
        confirmation_method: 'manual',
        confirm: false,
        metadata: {
          userId: createPaymentDto.userId,
          accountId: createPaymentDto.accountId,
          traceId,
          type: 'one_time_payment'
        },
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        }
      });

      // Save payment record to database
      const payment = new this.paymentModel({
        userId: createPaymentDto.userId,
        accountId: createPaymentDto.accountId,
        stripePaymentIntentId: paymentIntent.id,
        amount: createPaymentDto.amount,
        currency,
        description: createPaymentDto.description,
        status: 'pending',
        paymentMethod: 'stripe',
        metadata: {
          traceId,
          type: 'one_time_payment'
        }
      });

      await payment.save({session});

      this.logger.log(`Payment intent created successfully`, {
        traceId,
        paymentIntentId: paymentIntent.id,
        amount: createPaymentDto.amount,
        currency
      });

      return {paymentIntent, payment};
    } catch (error) {
      this.logger.error(`Failed to create payment intent`, {
        traceId,
        error: error.message,
        userId: createPaymentDto.userId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentException(`Stripe error: ${error.message}`, 'STRIPE_API_ERROR');
      }
      throw error;
    }
  }

  /**
   * Confirm payment intent
   */
  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId?: string): Promise<Stripe.PaymentIntent> {
    this.ensureStripeInitialized();

    const traceId = uuidv4();
    this.logger.log(`Confirming payment intent`, {traceId, paymentIntentId});

    try {
      const confirmParams: Stripe.PaymentIntentConfirmParams = {};

      if (paymentMethodId) {
        confirmParams.payment_method = paymentMethodId;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, confirmParams);

      // Update payment record
      await this.paymentModel.updateOne(
        {stripePaymentIntentId: paymentIntentId},
        {
          status: paymentIntent.status,
          updatedAt: new Date(),
          $push: {
            statusHistory: {
              status: paymentIntent.status,
              timestamp: new Date(),
              metadata: {traceId, action: 'confirm'}
            }
          }
        }
      );

      this.logger.log(`Payment intent confirmed`, {
        traceId,
        paymentIntentId,
        status: paymentIntent.status
      });

      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to confirm payment intent`, {
        traceId,
        error: error.message,
        paymentIntentId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentException(`Stripe error: ${error.message}`, 'STRIPE_API_ERROR');
      }
      throw error;
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(
    createSubscriptionDto: CreateSubscriptionDto,
    session?: ClientSession
  ): Promise<{subscription: Stripe.Subscription; subscriptionDoc: SubscriptionDocument}> {
    this.ensureStripeInitialized();

    const traceId = uuidv4();
    this.logger.log(`Creating subscription`, {traceId, ...createSubscriptionDto});

    try {
      // Validate required fields
      if (!createSubscriptionDto.userId) {
        throw new ValidationException('User ID is required', 'USER_ID_REQUIRED');
      }
      if (!(createSubscriptionDto as any).accountType) {
        throw new ValidationException('Account type is required', 'ACCOUNT_TYPE_REQUIRED');
      }

      // Get customer
      const customer = await this.customerModel.findOne({userId: createSubscriptionDto.userId}).session(session || null);
      if (!customer) {
        throw new NotFoundResourceException('Customer not found', 'USER_NOT_FOUND');
      }

      // Get price configuration
      const productConfig = this.configService.get(`stripe.products.${(createSubscriptionDto as any).accountType}`);
      if (!productConfig?.priceId) {
        throw new ValidationException(`No price configured for account type: ${(createSubscriptionDto as any).accountType}`, 'INVALID_ACCOUNT_TYPE');
      }

      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customer.stripeCustomerId,
        items: [{price: productConfig.priceId}],
        payment_behavior: 'default_incomplete',
        payment_settings: {save_default_payment_method: 'on_subscription'},
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: createSubscriptionDto.userId,
          accountType: (createSubscriptionDto as any).accountType,
          traceId
        }
      };

      // Add trial period if specified
      if ((createSubscriptionDto as any).trialPeriodDays) {
        subscriptionParams.trial_period_days = (createSubscriptionDto as any).trialPeriodDays;
      } else {
        const defaultTrialDays = this.configService.get<number>('stripe.subscription.trialPeriodDays');
        if (defaultTrialDays && defaultTrialDays > 0) {
          subscriptionParams.trial_period_days = defaultTrialDays;
        }
      }

      // Add automatic tax if enabled
      if (this.configService.get<boolean>('stripe.subscription.automaticTax')) {
        subscriptionParams.automatic_tax = {enabled: true};
      }

      // Create subscription in Stripe
      const subscription = await this.stripe.subscriptions.create(subscriptionParams);

      // Save subscription to database
      const subscriptionDoc = new this.subscriptionModel({
        userId: createSubscriptionDto.userId,
        accountType: (createSubscriptionDto as any).accountType,
        stripeSubscriptionId: subscription.id,
        stripePriceId: productConfig.priceId,
        stripeProductId: productConfig.productId,
        status: subscription.status,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        isActive: ['active', 'trialing'].includes(subscription.status),
        metadata: {
          traceId,
          features: productConfig.features
        }
      });

      await subscriptionDoc.save({session});

      this.logger.log(`Subscription created successfully`, {
        traceId,
        subscriptionId: subscription.id,
        status: subscription.status,
        accountType: (createSubscriptionDto as any).accountType
      });

      return {subscription, subscriptionDoc};
    } catch (error) {
      this.logger.error(`Failed to create subscription`, {
        traceId,
        error: error.message,
        userId: createSubscriptionDto.userId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentException(`Stripe error: ${error.message}`, 'STRIPE_API_ERROR');
      }
      throw error;
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscriptionId: string, updateSubscriptionDto: UpdateSubscriptionDto, session?: ClientSession): Promise<Stripe.Subscription> {
    this.ensureStripeInitialized();

    const traceId = uuidv4();
    this.logger.log(`Updating subscription`, {traceId, subscriptionId, ...updateSubscriptionDto});

    try {
      const updateParams: Stripe.SubscriptionUpdateParams = {};

      // Update plan if provided
      if (updateSubscriptionDto.newAccountType) {
        const productConfig = this.configService.get(`stripe.products.${updateSubscriptionDto.newAccountType}`);
        if (!productConfig?.priceId) {
          throw new ValidationException(`No price configured for account type: ${updateSubscriptionDto.newAccountType}`, 'INVALID_ACCOUNT_TYPE');
        }

        updateParams.items = [
          {
            id: undefined, // Let Stripe handle the item ID
            price: productConfig.priceId
          }
        ];
        updateParams.proration_behavior = updateSubscriptionDto.prorationBehavior || 'create_prorations';
      }

      // Update metadata
      if (updateSubscriptionDto.metadata) {
        updateParams.metadata = {
          ...updateSubscriptionDto.metadata,
          traceId,
          lastModified: new Date().toISOString()
        };
      }

      const subscription = await this.stripe.subscriptions.update(subscriptionId, updateParams);

      // Update subscription in database
      const updateData: any = {
        status: subscription.status,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        isActive: ['active', 'trialing'].includes(subscription.status),
        updatedAt: new Date()
      };

      if (updateSubscriptionDto.newAccountType) {
        const productConfig = this.configService.get(`stripe.products.${updateSubscriptionDto.newAccountType}`);
        updateData.accountType = updateSubscriptionDto.newAccountType;
        updateData.stripePriceId = productConfig.priceId;
        updateData.stripeProductId = productConfig.productId;
        updateData['metadata.features'] = productConfig.features;
      }

      await this.subscriptionModel.updateOne({stripeSubscriptionId: subscriptionId}, {$set: updateData}, {session});

      this.logger.log(`Subscription updated successfully`, {
        traceId,
        subscriptionId,
        status: subscription.status
      });

      return subscription;
    } catch (error) {
      this.logger.error(`Failed to update subscription`, {
        traceId,
        error: error.message,
        subscriptionId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentException(`Stripe error: ${error.message}`, 'STRIPE_API_ERROR');
      }
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true, session?: ClientSession): Promise<Stripe.Subscription> {
    this.ensureStripeInitialized();

    const traceId = uuidv4();
    this.logger.log(`Canceling subscription`, {traceId, subscriptionId, cancelAtPeriodEnd});

    try {
      let subscription: Stripe.Subscription;

      if (cancelAtPeriodEnd) {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
          metadata: {traceId, cancelAction: 'at_period_end'}
        });
      } else {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId, {
          prorate: true
        });
      }

      // Update subscription in database
      await this.subscriptionModel.updateOne(
        {stripeSubscriptionId: subscriptionId},
        {
          $set: {
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            isActive: subscription.status === 'active',
            updatedAt: new Date()
          }
        },
        {session}
      );

      this.logger.log(`Subscription canceled successfully`, {
        traceId,
        subscriptionId,
        cancelAtPeriodEnd,
        status: subscription.status
      });

      return subscription;
    } catch (error) {
      this.logger.error(`Failed to cancel subscription`, {
        traceId,
        error: error.message,
        subscriptionId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentException(`Stripe error: ${error.message}`, 'STRIPE_API_ERROR');
      }
      throw error;
    }
  }

  /**
   * Retrieve subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    this.ensureStripeInitialized();

    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer']
      });
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentException(`Stripe error: ${error.message}`, 'STRIPE_API_ERROR');
      }
      throw error;
    }
  }

  /**
   * Create setup intent for saving payment methods
   */
  async createSetupIntent(customerId: string, paymentMethodTypes: string[] = ['card']): Promise<Stripe.SetupIntent> {
    this.ensureStripeInitialized();

    const traceId = uuidv4();
    this.logger.log(`Creating setup intent`, {traceId, customerId});

    try {
      const customer = await this.customerModel.findOne({stripeCustomerId: customerId});
      if (!customer) {
        throw new NotFoundResourceException('Customer not found', 'CUSTOMER_NOT_FOUND');
      }

      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId.toString(),
        payment_method_types: paymentMethodTypes,
        usage: 'off_session',
        metadata: {
          userId: customer.userId.toString(),
          traceId
        }
      });

      this.logger.log(`Setup intent created successfully`, {
        traceId,
        setupIntentId: setupIntent.id,
        customerId
      });

      return setupIntent;
    } catch (error) {
      this.logger.error(`Failed to create setup intent`, {
        traceId,
        error: error.message,
        customerId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentException(`Stripe error: ${error.message}`, 'STRIPE_API_ERROR');
      }
      throw error;
    }
  }

  /**
   * List customer payment methods
   */
  async listPaymentMethods(customerId: string, type: string = 'card'): Promise<Stripe.PaymentMethod[]> {
    this.ensureStripeInitialized();

    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: type as Stripe.PaymentMethodListParams.Type
      });

      return paymentMethods.data;
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentException(`Stripe error: ${error.message}`, 'STRIPE_API_ERROR');
      }
      throw error;
    }
  }

  /**
   * Detach payment method
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    this.ensureStripeInitialized();

    const traceId = uuidv4();
    this.logger.log(`Detaching payment method`, {traceId, paymentMethodId});

    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);

      this.logger.log(`Payment method detached successfully`, {
        traceId,
        paymentMethodId
      });

      return paymentMethod;
    } catch (error) {
      this.logger.error(`Failed to detach payment method`, {
        traceId,
        error: error.message,
        paymentMethodId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentException(`Stripe error: ${error.message}`, 'STRIPE_API_ERROR');
      }
      throw error;
    }
  }

  /**
   * Get publishable key for frontend
   */
  getPublishableKey(): string {
    return this.configService.get<string>('stripe.publishableKey') || '';
  }

  /**
   * Construct webhook event
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    this.ensureStripeInitialized();

    const webhookSecret = this.configService.get<string>('stripe.webhookSecret');
    if (!webhookSecret) {
      throw new PaymentException('Webhook secret not configured', 'WEBHOOK_SECRET_MISSING');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      throw new PaymentException(`Webhook signature verification failed: ${error.message}`, 'WEBHOOK_VERIFICATION_FAILED');
    }
  }
}
