import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethodsRepository } from './payment-methods.repository';
import { PaymentMethod, PaymentMethodSchema } from './schemas/payment-method.schema';
import { CommonModule } from '@common/common.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: PaymentMethod.name, schema: PaymentMethodSchema }]), CommonModule],
  providers: [PaymentMethodsService, PaymentMethodsRepository],
  exports: [PaymentMethodsService, PaymentMethodsRepository]
})
export class PaymentMethodsModule {}
