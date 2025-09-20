import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

import { BillingCustomer, BillingCustomerDocument } from '../schemas/billing-customer.schema';
import { EnhancedPayment, EnhancedPaymentDocument } from '../schemas/enhanced-payment.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { Subscription, SubscriptionDocument } from '../schemas/subscription.schema';

import { PaymentException } from '../../common/exceptions/payment.exception';
import { DatabaseService } from '../../database/database.service';
import { StripeService } from './stripe.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(EnhancedPayment.name) private enhancedPaymentModel: Model<EnhancedPaymentDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(BillingCustomer.name) private customerModel: Model<BillingCustomerDocument>,
    private databaseService: DatabaseService,
    private stripeService: StripeService
  ) {}

  /**
   * Handle webhook request with validation and error handling
   */
  async handleWebhookRequest(rawBody: Buffer | string, signature: string): Promise<void> {
    if (!signature) {
      throw new PaymentException('Missing stripe-signature header', 'MISSING_SIGNATURE');
    }

    if (!rawBody) {
      throw new PaymentException('Missing raw body', 'MISSING_RAW_BODY');
    }

    try {
      // Construct and verify webhook event
      const event = this.stripeService.constructWebhookEvent(rawBody, signature);

      // Process the event
      await this.processWebhookEvent(event);
    } catch (error) {
      if (error instanceof PaymentException) {
        throw error;
      }

      throw new PaymentException(`Webhook error: ${error.message}`, 'WEBHOOK_ERROR');
    }
  }

  /**
   * Process Stripe webhook events
   */
  async processWebhookEvent(event: Stripe.Event): Promise<void> {
    const traceId = uuidv4();
    this.logger.log(`Processing webhook event: ${event.type}`, {
      traceId,
      eventId: event.id,
      eventType: event.type
    });

    const session = await this.databaseService.startSession();

    try {
      await session.withTransaction(async () => {
        switch (event.type) {
          // Payment Intent Events
          case 'payment_intent.created':
            await this.handlePaymentIntentCreated(event.data.object, traceId, session);
            break;
          case 'payment_intent.succeeded':
            await this.handlePaymentIntentSucceeded(event.data.object, traceId, session);
            break;
          case 'payment_intent.payment_failed':
            await this.handlePaymentIntentFailed(event.data.object, traceId, session);
            break;
          case 'payment_intent.canceled':
            await this.handlePaymentIntentCanceled(event.data.object, traceId, session);
            break;
          case 'payment_intent.requires_action':
            await this.handlePaymentIntentRequiresAction(event.data.object, traceId, session);
            break;

          // Customer Events
          case 'customer.created':
            await this.handleCustomerCreated(event.data.object, traceId, session);
            break;
          case 'customer.updated':
            await this.handleCustomerUpdated(event.data.object, traceId, session);
            break;
          case 'customer.deleted':
            await this.handleCustomerDeleted(event.data.object, traceId, session);
            break;

          // Subscription Events
          case 'customer.subscription.created':
            await this.handleSubscriptionCreated(event.data.object, traceId, session);
            break;
          case 'customer.subscription.updated':
            await this.handleSubscriptionUpdated(event.data.object, traceId, session);
            break;
          case 'customer.subscription.deleted':
            await this.handleSubscriptionDeleted(event.data.object, traceId, session);
            break;
          case 'customer.subscription.trial_will_end':
            await this.handleSubscriptionTrialWillEnd(event.data.object, traceId, session);
            break;

          // Invoice Events
          case 'invoice.created':
            await this.handleInvoiceCreated(event.data.object, traceId, session);
            break;
          case 'invoice.payment_succeeded':
            await this.handleInvoicePaymentSucceeded(event.data.object, traceId, session);
            break;
          case 'invoice.payment_failed':
            await this.handleInvoicePaymentFailed(event.data.object, traceId, session);
            break;
          case 'invoice.upcoming':
            await this.handleInvoiceUpcoming(event.data.object, traceId, session);
            break;

          // Payment Method Events
          case 'payment_method.attached':
            await this.handlePaymentMethodAttached(event.data.object, traceId, session);
            break;
          case 'payment_method.detached':
            await this.handlePaymentMethodDetached(event.data.object, traceId, session);
            break;

          // Setup Intent Events
          case 'setup_intent.succeeded':
            await this.handleSetupIntentSucceeded(event.data.object, traceId, session);
            break;

          // Checkout Events
          case 'checkout.session.completed':
            await this.handleCheckoutSessionCompleted(event.data.object, traceId, session);
            break;

          // Dispute Events
          case 'charge.dispute.created':
            await this.handleDisputeCreated(event.data.object, traceId, session);
            break;

          default:
            this.logger.debug(`Unhandled webhook event type: ${event.type}`, { traceId, eventId: event.id });
        }

        // Record successful webhook processing
        await this.recordWebhookProcessing(event, traceId, true, session);
      });

      this.logger.log(`Webhook event processed successfully`, {
        traceId,
        eventId: event.id,
        eventType: event.type
      });
    } catch (error) {
      this.logger.error(`Failed to process webhook event`, {
        traceId,
        eventId: event.id,
        eventType: event.type,
        error: error.message
      });

      // Record failed webhook processing
      await this.recordWebhookProcessing(event, traceId, false, session, error.message);

      throw new PaymentException(`Webhook processing failed: ${error.message}`, 'WEBHOOK_PROCESSING_FAILED');
    } finally {
      await session.endSession();
    }
  }

  private async handlePaymentIntentCreated(paymentIntent: Stripe.PaymentIntent, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling payment intent created`, { traceId, paymentIntentId: paymentIntent.id });

    // Update payment record if it exists
    const payment = await this.enhancedPaymentModel
      .findOne({
        stripePaymentIntentId: paymentIntent.id
      })
      .session(session);

    if (payment) {
      payment.status = paymentIntent.status as any;
      payment.stripeClientSecret = paymentIntent.client_secret || undefined;
      payment.webhookEvents.push({
        eventId: paymentIntent.id,
        eventType: 'payment_intent.created',
        processedAt: new Date(),
        success: true
      });
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling payment intent succeeded`, { traceId, paymentIntentId: paymentIntent.id });

    const payment = await this.enhancedPaymentModel
      .findOne({
        stripePaymentIntentId: paymentIntent.id
      })
      .session(session);

    if (payment) {
      payment.status = 'succeeded';
      payment.processedAt = new Date();

      // Update payment method details if available
      if ((paymentIntent as any).charges?.data?.[0]?.payment_method_details) {
        const pmDetails = (paymentIntent as any).charges.data[0].payment_method_details;
        payment.paymentMethodDetails = this.extractPaymentMethodDetails(pmDetails);
      }

      // Update financial details
      if ((paymentIntent as any).charges?.data?.[0]) {
        const charge = (paymentIntent as any).charges.data[0];
        payment.stripeFeeAmount = charge.application_fee_amount || 0;
        payment.netAmount = payment.amount - (payment.stripeFeeAmount || 0);
        payment.receiptUrl = charge.receipt_url;
        payment.receiptNumber = charge.receipt_number;
      }

      payment.webhookEvents.push({
        eventId: paymentIntent.id,
        eventType: 'payment_intent.succeeded',
        processedAt: new Date(),
        success: true
      });
      await payment.save();
    }
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling payment intent failed`, { traceId, paymentIntentId: paymentIntent.id });

    const payment = await this.enhancedPaymentModel
      .findOne({
        stripePaymentIntentId: paymentIntent.id
      })
      .session(session);

    if (payment) {
      payment.status = 'failed';
      payment.failureCode = paymentIntent.last_payment_error?.code;
      payment.failureMessage = paymentIntent.last_payment_error?.message;
      payment.declineCode = paymentIntent.last_payment_error?.decline_code;

      payment.webhookEvents.push({
        eventId: paymentIntent.id,
        eventType: 'payment_intent.payment_failed',
        processedAt: new Date(),
        success: true
      });
      await payment.save();
    }
  }

  private async handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling payment intent canceled`, { traceId, paymentIntentId: paymentIntent.id });

    const payment = await this.enhancedPaymentModel
      .findOne({
        stripePaymentIntentId: paymentIntent.id
      })
      .session(session);

    if (payment) {
      payment.status = 'canceled';
      payment.webhookEvents.push({
        eventId: paymentIntent.id,
        eventType: 'payment_intent.canceled',
        processedAt: new Date(),
        success: true
      });
      await payment.save();
    }
  }

  private async handlePaymentIntentRequiresAction(paymentIntent: Stripe.PaymentIntent, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling payment intent requires action`, { traceId, paymentIntentId: paymentIntent.id });

    const payment = await this.enhancedPaymentModel
      .findOne({
        stripePaymentIntentId: paymentIntent.id
      })
      .session(session);

    if (payment) {
      payment.status = 'requires_action';
      payment.webhookEvents.push({
        eventId: paymentIntent.id,
        eventType: 'payment_intent.requires_action',
        processedAt: new Date(),
        success: true
      });
      await payment.save();
    }
  }

  private async handleCustomerCreated(customer: Stripe.Customer, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling customer created`, { traceId, customerId: customer.id });

    // Update customer record with Stripe data
    await this.customerModel.updateOne(
      { stripeCustomerId: customer.id },
      {
        $set: {
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          updatedAt: new Date()
        }
      },
      { session, upsert: false }
    );
  }

  private async handleCustomerUpdated(customer: Stripe.Customer, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling customer updated`, { traceId, customerId: customer.id });

    await this.customerModel.updateOne(
      { stripeCustomerId: customer.id },
      {
        $set: {
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          updatedAt: new Date()
        }
      },
      { session }
    );
  }

  private async handleCustomerDeleted(customer: Stripe.Customer, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling customer deleted`, { traceId, customerId: customer.id });

    await this.customerModel.updateOne(
      { stripeCustomerId: customer.id },
      {
        $set: {
          isActive: false,
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { session }
    );
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling subscription created`, { traceId, subscriptionId: subscription.id });

    const existingSubscription = await this.subscriptionModel
      .findOne({
        stripeSubscriptionId: subscription.id
      })
      .session(session);

    if (existingSubscription) {
      existingSubscription.status = subscription.status as any;
      existingSubscription.currentPeriodStart = new Date((subscription as any).current_period_start * 1000);
      existingSubscription.currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
      (existingSubscription as any).isActive = ['active', 'trialing'].includes(subscription.status);
      await existingSubscription.save({ session });
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling subscription updated`, { traceId, subscriptionId: subscription.id });

    await this.subscriptionModel.updateOne(
      { stripeSubscriptionId: subscription.id },
      {
        $set: {
          status: subscription.status,
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          isActive: ['active', 'trialing'].includes(subscription.status),
          updatedAt: new Date()
        }
      },
      { session }
    );
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling subscription deleted`, { traceId, subscriptionId: subscription.id });

    await this.subscriptionModel.updateOne(
      { stripeSubscriptionId: subscription.id },
      {
        $set: {
          status: 'canceled',
          isActive: false,
          canceledAt: new Date(),
          updatedAt: new Date()
        }
      },
      { session }
    );
  }

  private async handleSubscriptionTrialWillEnd(subscription: Stripe.Subscription, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling subscription trial will end`, { traceId, subscriptionId: subscription.id });

    // Here you could send notification emails, etc.
    // For now, just log the event
    this.logger.log(`Trial ending soon for subscription: ${subscription.id}`, {
      traceId,
      customerId: subscription.customer,
      trialEnd: subscription.trial_end
    });
  }

  private async handleInvoiceCreated(invoice: Stripe.Invoice, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling invoice created`, { traceId, invoiceId: invoice.id });

    // Update payment records with invoice information
    if ((invoice as any).payment_intent) {
      await this.enhancedPaymentModel.updateOne(
        { stripePaymentIntentId: (invoice as any).payment_intent as string },
        {
          $set: {
            stripeInvoiceId: invoice.id,
            invoiceNumber: invoice.number,
            invoiceUrl: invoice.hosted_invoice_url
          }
        },
        { session }
      );
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling invoice payment succeeded`, { traceId, invoiceId: invoice.id });

    if ((invoice as any).payment_intent) {
      await this.enhancedPaymentModel.updateOne(
        { stripePaymentIntentId: (invoice as any).payment_intent as string },
        {
          $set: {
            status: 'succeeded',
            processedAt: new Date()
          }
        },
        { session }
      );
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling invoice payment failed`, { traceId, invoiceId: invoice.id });

    if ((invoice as any).payment_intent) {
      await this.enhancedPaymentModel.updateOne(
        { stripePaymentIntentId: (invoice as any).payment_intent as string },
        {
          $set: {
            status: 'failed',
            failureMessage: 'Invoice payment failed'
          }
        },
        { session }
      );
    }
  }

  private async handleInvoiceUpcoming(invoice: Stripe.Invoice, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling upcoming invoice`, { traceId, invoiceId: invoice.id });

    // Here you could send notification emails for upcoming payments
    this.logger.log(`Upcoming invoice for customer: ${invoice.customer}`, {
      traceId,
      amount: invoice.amount_due,
      dueDate: invoice.due_date
    });
  }

  private async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling payment method attached`, { traceId, paymentMethodId: paymentMethod.id });

    // Update customer record with new payment method
    await this.customerModel.updateOne(
      { stripeCustomerId: paymentMethod.customer as string },
      {
        $addToSet: {
          paymentMethods: {
            stripePaymentMethodId: paymentMethod.id,
            type: paymentMethod.type,
            details: this.extractPaymentMethodDetails(paymentMethod as any),
            isDefault: false
          }
        },
        $set: { updatedAt: new Date() }
      },
      { session }
    );
  }

  private async handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling payment method detached`, { traceId, paymentMethodId: paymentMethod.id });

    // Remove payment method from customer record
    await this.customerModel.updateOne(
      { stripeCustomerId: paymentMethod.customer as string },
      {
        $pull: {
          paymentMethods: { stripePaymentMethodId: paymentMethod.id }
        },
        $set: { updatedAt: new Date() }
      },
      { session }
    );
  }

  private async handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling setup intent succeeded`, { traceId, setupIntentId: setupIntent.id });

    // Create a setup payment record
    const setupPayment = new this.enhancedPaymentModel({
      userId: setupIntent.metadata?.userId,
      stripePaymentIntentId: setupIntent.id,
      stripeCustomerId: setupIntent.customer as string,
      stripePaymentMethodId: setupIntent.payment_method as string,
      amount: 0,
      currency: 'usd',
      status: 'succeeded',
      paymentMethod: 'stripe',
      type: 'setup',
      description: 'Payment method setup',
      processedAt: new Date(),
      metadata: {
        traceId,
        setupIntent: true
      }
    });

    await setupPayment.save({ session });
  }

  private async handleCheckoutSessionCompleted(session_obj: Stripe.Checkout.Session, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling checkout session completed`, { traceId, sessionId: session_obj.id });

    if (session_obj.payment_intent) {
      await this.enhancedPaymentModel.updateOne(
        { stripePaymentIntentId: session_obj.payment_intent as string },
        {
          $set: {
            metadata: {
              ...session_obj.metadata,
              checkoutSessionId: session_obj.id,
              checkoutCompleted: true
            }
          }
        },
        { session }
      );
    }
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute, traceId: string, session: ClientSession): Promise<void> {
    this.logger.log(`Handling dispute created`, { traceId, disputeId: dispute.id });

    // Find payment by charge ID
    const payment = await this.enhancedPaymentModel
      .findOne({
        stripeChargeId: dispute.charge as string
      })
      .session(session);

    if (payment) {
      payment.disputed = true;
      payment.disputedAt = new Date(dispute.created * 1000);
      payment.disputeDetails = {
        id: dispute.id,
        reason: dispute.reason,
        status: dispute.status,
        evidence: dispute.evidence,
        evidenceDeadline: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : undefined
      };

      payment.webhookEvents.push({
        eventId: dispute.id,
        eventType: 'charge.dispute.created',
        processedAt: new Date(),
        success: true
      });
      await payment.save();
    }
  }

  private extractPaymentMethodDetails(pmDetails: any): any {
    if (!pmDetails) return null;

    const details: any = {
      type: pmDetails.type
    };

    if (pmDetails.card) {
      details.last4 = pmDetails.card.last4;
      details.brand = pmDetails.card.brand;
      details.expMonth = pmDetails.card.exp_month;
      details.expYear = pmDetails.card.exp_year;
      details.country = pmDetails.card.country;
      details.fingerprint = pmDetails.card.fingerprint;
      details.wallet = pmDetails.card.wallet?.type;
    } else if (pmDetails.us_bank_account) {
      details.last4 = pmDetails.us_bank_account.last4;
      details.bankName = pmDetails.us_bank_account.bank_name;
      details.country = 'US';
    } else if (pmDetails.sepa_debit) {
      details.last4 = pmDetails.sepa_debit.last4;
      details.bankName = pmDetails.sepa_debit.bank_code;
      details.country = pmDetails.sepa_debit.country;
    }

    return details;
  }

  private async recordWebhookProcessing(event: Stripe.Event, traceId: string, success: boolean, session: ClientSession, error?: string): Promise<void> {
    // Find related payment records and update webhook history
    const paymentIntentId = this.extractPaymentIntentId(event);

    if (paymentIntentId) {
      await this.enhancedPaymentModel.updateOne(
        { stripePaymentIntentId: paymentIntentId },
        {
          $push: {
            webhookEvents: {
              eventId: event.id,
              eventType: event.type,
              processedAt: new Date(),
              success,
              error
            }
          }
        },
        { session }
      );
    }
  }

  private extractPaymentIntentId(event: Stripe.Event): string | null {
    const data = event.data.object as any;

    if (data.object === 'payment_intent') {
      return data.id;
    }

    if (data.payment_intent) {
      return data.payment_intent;
    }

    if (data.invoice?.payment_intent) {
      return data.invoice.payment_intent;
    }

    return null;
  }
}
