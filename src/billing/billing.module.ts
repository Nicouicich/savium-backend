import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

// Services
import { BillingService } from './services/billing.service';
import { PaymentSecurityService } from './services/payment-security.service';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { StripeService } from './services/stripe.service';

// Controllers
import { BillingController } from './billing.controller';
import { StripePaymentsController } from './controllers/stripe-payments.controller';

// Schemas
import { UserProfile, UserProfileSchema } from '../users/schemas/user-profile.schema';
import { BillingCustomer, BillingCustomerSchema } from './schemas/billing-customer.schema';
import { EnhancedPayment, EnhancedPaymentSchema } from './schemas/enhanced-payment.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';

// External modules
import { DatabaseModule } from '../database/database.module';

// Configuration
import { stripeConfig } from '../config';

@Module({
  imports: [
    ConfigModule.forFeature(stripeConfig),
    MongooseModule.forFeature([
      { name: BillingCustomer.name, schema: BillingCustomerSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: EnhancedPayment.name, schema: EnhancedPaymentSchema },
      { name: UserProfile.name, schema: UserProfileSchema }
    ]),
    DatabaseModule
  ],
  controllers: [BillingController, StripePaymentsController],
  providers: [BillingService, StripeService, StripeWebhookService, PaymentSecurityService],
  exports: [BillingService, StripeService, StripeWebhookService, PaymentSecurityService]
})
export class BillingModule {}
