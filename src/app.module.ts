import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuration imports
import {
  appConfig,
  awsConfig,
  configValidationSchema,
  databaseConfig,
  facebookConfig,
  googleConfig,
  integrationsConfig,
  jwtConfig,
  redisConfig,
  stripeConfig,
  swaggerConfig
} from './config';

// Module imports
import { CommonModule } from '@common/common.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { FilesModule } from './files/files.module';
import { GoalsModule } from './goals/goals.module';
import { AiModule } from './integrations/ai/ai.module';
import { MessagingIntegrationModule } from './integrations/messaging/messaging-integration.module';
import { TelegramModule } from './integrations/telegram/telegram.module';
import { WhatsappModule } from './integrations/whatsapp/whatsapp.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReferralsModule } from './referrals/referrals.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: '.env',
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false
      },
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, swaggerConfig, integrationsConfig, stripeConfig, googleConfig, facebookConfig, awsConfig]
    }),

    // Database Module
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const dbOptions = configService.get('database.options') || {};
        return {
          uri: configService.get('database.uri'),
          ...dbOptions
        };
      },
      inject: [ConfigService]
    }),

    // Cache Module with Redis
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (configService: ConfigService) => ({
        store: 'redis',
        host: configService.get('redis.host'),
        port: configService.get('redis.port'),
        password: configService.get('redis.password'),
        db: configService.get('redis.db'),
        ttl: configService.get('redis.cache.ttl'),
        max: configService.get('redis.cache.maxItems')
      }),
      inject: [ConfigService]
    }),

    // Throttler Module for Rate Limiting
    ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: (configService.get('redis.throttle.ttl') || 60) * 1000,
            limit: configService.get('redis.throttle.limit') || 100
          },
          {
            name: 'medium',
            ttl: 60 * 60 * 1000, // 1 hour
            limit: 1000
          },
          {
            name: 'long',
            ttl: 24 * 60 * 60 * 1000, // 24 hours
            limit: 10000
          }
        ]
      }),
      inject: [ConfigService]
    }),

    // Application modules
    CommonModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    TransactionsModule,
    ReportsModule,
    BudgetsModule,
    GoalsModule,
    AiModule,
    WhatsappModule,
    TelegramModule,
    MessagingIntegrationModule,
    NotificationsModule,
    MailModule,
    BillingModule,
    SettingsModule,
    ReferralsModule,
    FilesModule
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: []
})
export class AppModule {}
