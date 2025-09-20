import { CommonModule } from '@common/common.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { CardsController } from './cards.controller';
import { CardsRepository } from './cards.repository';
import { CardsService } from './cards.service';
import { CardBalance, CardBalanceSchema } from './schemas/card-balance.schema';
import { Card, CardSchema } from './schemas/card.schema';
import { CardAnalyticsService } from './services/card-analytics.service';
import { CardBalanceService } from './services/card-balance.service';

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
