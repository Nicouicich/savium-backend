import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { BillingService } from './services/billing.service';
import { BillingController } from './billing.controller';

import { BillingCustomer, BillingCustomerSchema } from './schemas/billing-customer.schema';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { UserProfile, UserProfileSchema } from '../users/schemas/user-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BillingCustomer.name, schema: BillingCustomerSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: UserProfile.name, schema: UserProfileSchema }
    ])
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService]
})
export class BillingModule {}
