import { CommonModule } from '@common/common.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentMethodsRepository } from './payment-methods.repository';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethod, PaymentMethodSchema } from './schemas/payment-method.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: PaymentMethod.name, schema: PaymentMethodSchema }]), CommonModule],
  providers: [PaymentMethodsService, PaymentMethodsRepository],
  exports: [PaymentMethodsService, PaymentMethodsRepository]
})
export class PaymentMethodsModule {}
