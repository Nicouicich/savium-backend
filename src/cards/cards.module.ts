import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { CardsRepository } from './cards.repository';
import { CardBalanceService } from './services/card-balance.service';
import { CardAnalyticsService } from './services/card-analytics.service';
import { Card, CardSchema } from './schemas/card.schema';
import { CardBalance, CardBalanceSchema } from './schemas/card-balance.schema';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { CommonModule } from '@common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Card.name, schema: CardSchema },
      { name: CardBalance.name, schema: CardBalanceSchema }
    ]),
    PaymentMethodsModule,
    CommonModule
  ],
  controllers: [CardsController],
  providers: [CardsService, CardsRepository, CardBalanceService, CardAnalyticsService],
  exports: [CardsService, CardsRepository, CardBalanceService, CardAnalyticsService]
})
export class CardsModule {}
