import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  HttpCode,
  Headers,
  type RawBodyRequest
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestTracingInterceptor } from '../../common/interceptors/request-tracing.interceptor';
import { GetUser } from '../../common/decorators/get-user.decorator';

import { StripeService } from '../services/stripe.service';
import { StripeWebhookService } from '../services/stripe-webhook.service';

import { CreatePaymentIntentDto, CreateSubscriptionDto, UpdateSubscriptionDto, CreateCustomerDto } from '../dto';

import type { UserProfileDocument } from '../../users/schemas/user-profile.schema';

@ApiTags('Stripe Payments')
@Controller('stripe')
@UseInterceptors(RequestTracingInterceptor)
@UseGuards(ThrottlerGuard)
export class StripePaymentsController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookService: StripeWebhookService
  ) {}

  @Post('customer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create or retrieve Stripe customer',
    description: 'Creates a new Stripe customer or retrieves existing one for the authenticated user'
  })
  @ApiResponse({ status: 201, description: 'Customer created or retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createCustomer(@GetUser() user: UserProfileDocument, @Body() createCustomerDto: CreateCustomerDto) {
    const customerData = {
      ...createCustomerDto,
      userId: (user._id as any).toString()
    };

    const customer = await this.stripeService.createOrGetCustomer(customerData);

    return {
      success: true,
      data: {
        customerId: customer._id,
        stripeCustomerId: customer.stripeCustomerId,
        email: customer.email,
        name: customer.name
      }
    };
  }

  @Post('payment-intent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create payment intent',
    description: 'Creates a new Stripe payment intent for one-time payments'
  })
  @ApiResponse({ status: 201, description: 'Payment intent created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPaymentIntent(@GetUser() user: UserProfileDocument, @Body() createPaymentDto: CreatePaymentIntentDto) {
    const { paymentIntent, payment } = await this.stripeService.createPaymentIntent({
      ...createPaymentDto,
      userId: (user._id as any).toString()
    });

    return {
      success: true,
      data: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: payment.amount,
        currency: payment.currency,
        status: paymentIntent.status,
        paymentId: payment._id
      }
    };
  }

  @Post('payment-intent/:paymentIntentId/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirm payment intent',
    description: 'Confirms a payment intent with optional payment method'
  })
  @ApiParam({ name: 'paymentIntentId', description: 'Stripe payment intent ID' })
  @ApiResponse({ status: 200, description: 'Payment intent confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid confirmation data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async confirmPaymentIntent(@Param('paymentIntentId') paymentIntentId: string, @Body() confirmData: { paymentMethodId?: string }) {
    const paymentIntent = await this.stripeService.confirmPaymentIntent(paymentIntentId, confirmData.paymentMethodId);

    return {
      success: true,
      data: {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      }
    };
  }

  @Post('subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create subscription',
    description: 'Creates a new Stripe subscription for the user'
  })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid subscription data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSubscription(@GetUser() user: UserProfileDocument, @Body() createSubscriptionDto: CreateSubscriptionDto) {
    const { subscription, subscriptionDoc } = await this.stripeService.createSubscription({
      ...createSubscriptionDto,
      userId: (user._id as any).toString()
    });

    return {
      success: true,
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        accountType: (subscriptionDoc as any).accountType,
        currentPeriodStart: subscriptionDoc.currentPeriodStart,
        currentPeriodEnd: subscriptionDoc.currentPeriodEnd,
        trialEnd: subscriptionDoc.trialEnd,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret
      }
    };
  }

  @Put('subscription/:subscriptionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update subscription',
    description: 'Updates an existing Stripe subscription'
  })
  @ApiParam({ name: 'subscriptionId', description: 'Stripe subscription ID' })
  @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async updateSubscription(@Param('subscriptionId') subscriptionId: string, @Body() updateSubscriptionDto: UpdateSubscriptionDto) {
    const subscription = await this.stripeService.updateSubscription(subscriptionId, updateSubscriptionDto);

    return {
      success: true,
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000)
      }
    };
  }

  @Delete('subscription/:subscriptionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel subscription',
    description: 'Cancels a Stripe subscription'
  })
  @ApiParam({ name: 'subscriptionId', description: 'Stripe subscription ID' })
  @ApiQuery({ name: 'atPeriodEnd', required: false, type: Boolean, description: 'Cancel at period end' })
  @ApiResponse({ status: 200, description: 'Subscription canceled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async cancelSubscription(@Param('subscriptionId') subscriptionId: string, @Query('atPeriodEnd') atPeriodEnd?: boolean) {
    const cancelAtPeriodEnd = atPeriodEnd !== undefined ? atPeriodEnd : true;

    const subscription = await this.stripeService.cancelSubscription(subscriptionId, cancelAtPeriodEnd);

    return {
      success: true,
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null
      }
    };
  }

  @Get('subscription/:subscriptionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get subscription details',
    description: 'Retrieves detailed information about a Stripe subscription'
  })
  @ApiParam({ name: 'subscriptionId', description: 'Stripe subscription ID' })
  @ApiResponse({ status: 200, description: 'Subscription details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getSubscription(@Param('subscriptionId') subscriptionId: string) {
    const subscription = await this.stripeService.getSubscription(subscriptionId);

    return {
      success: true,
      data: {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        items: subscription.items.data.map(item => ({
          id: item.id,
          priceId: item.price.id,
          productId: item.price.product,
          quantity: item.quantity
        }))
      }
    };
  }

  @Post('setup-intent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create setup intent',
    description: 'Creates a setup intent for saving payment methods'
  })
  @ApiResponse({ status: 201, description: 'Setup intent created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSetupIntent(@GetUser() user: UserProfileDocument, @Body() setupData: { customerId: string; paymentMethodTypes?: string[] }) {
    const setupIntent = await this.stripeService.createSetupIntent(setupData.customerId, setupData.paymentMethodTypes);

    return {
      success: true,
      data: {
        setupIntentId: setupIntent.id,
        clientSecret: setupIntent.client_secret,
        status: setupIntent.status
      }
    };
  }

  @Get('customer/:customerId/payment-methods')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List payment methods',
    description: 'Lists saved payment methods for a customer'
  })
  @ApiParam({ name: 'customerId', description: 'Stripe customer ID' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Payment method type' })
  @ApiResponse({ status: 200, description: 'Payment methods retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listPaymentMethods(@Param('customerId') customerId: string, @Query('type') type?: string) {
    const paymentMethods = await this.stripeService.listPaymentMethods(customerId, type);

    return {
      success: true,
      data: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card
          ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
              country: pm.card.country
            }
          : null,
        created: new Date(pm.created * 1000)
      }))
    };
  }

  @Delete('payment-method/:paymentMethodId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Detach payment method',
    description: 'Detaches a payment method from customer'
  })
  @ApiParam({ name: 'paymentMethodId', description: 'Stripe payment method ID' })
  @ApiResponse({ status: 200, description: 'Payment method detached successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async detachPaymentMethod(@Param('paymentMethodId') paymentMethodId: string) {
    const paymentMethod = await this.stripeService.detachPaymentMethod(paymentMethodId);

    return {
      success: true,
      data: {
        paymentMethodId: paymentMethod.id,
        status: 'detached'
      }
    };
  }

  @Get('config/publishable-key')
  @ApiOperation({
    summary: 'Get publishable key',
    description: 'Retrieves Stripe publishable key for frontend integration'
  })
  @ApiResponse({ status: 200, description: 'Publishable key retrieved successfully' })
  getPublishableKey() {
    const publishableKey = this.stripeService.getPublishableKey();

    return {
      success: true,
      data: {
        publishableKey
      }
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe webhook endpoint',
    description: 'Handles Stripe webhook events for payment processing'
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    await this.webhookService.handleWebhookRequest(req.rawBody || Buffer.from(''), signature);
    return { received: true };
  }
}
