import { forwardRef, Global, Module } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UsersModule } from '../src/users/users.module';

// Interceptors
import { ErrorHandlingInterceptor } from './interceptors/error-handling.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';

// Guards
import { EnhancedThrottlerGuard } from './guards/enhanced-throttler.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TokenBlacklistGuard } from './guards/token-blacklist.guard';
import { TwoFactorAuthGuard } from './guards/two-factor-auth.guard';

// Services
import { EncryptionService } from '../src/common/services/encryption.service';
import { RequestContextService } from '../src/common/services/request-context.service';
import { AdvancedRateLimiterService } from './services/advanced-rate-limiter.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { DatabasePerformanceService } from './services/database-performance.service';
import { EnhancedCacheService } from './services/enhanced-cache.service';
import { ErrorRecoveryService } from './services/error-recovery.service';
import { HealthCheckService } from './services/health-check.service';
import { MonitoringService } from './services/monitoring.service';
import { SanitizationService } from './services/sanitization.service';
import { SecurityAuditService } from './services/security-audit.service';
import { SmsVerificationService } from './services/sms-verification.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { TwoFactorAuthService } from './services/two-factor-auth.service';

// Filters
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { HttpExceptionFilter } from './filters/http-exception.filter';

// Decorators - These don't need to be provided as they are imported directly
export * from './decorators/api-response.decorator';
export * from './decorators/current-user.decorator';
export * from './decorators/roles.decorator';
export * from './decorators/validation.decorator';

// Constants and Enums
export * from './constants/card-types';
export * from './constants/transaction-categories';
export * from './constants/user-roles';

// Utils
export * from './utils/pagination.util';
export * from './utils/response.util';

// Pipes
export * from './pipes/parse-objectid.pipe';

// Services
export * from './guards/two-factor-auth.guard';
export * from './services/advanced-rate-limiter.service';
export * from './services/circuit-breaker.service';
export * from './services/database-performance.service';
export * from './services/enhanced-cache.service';
export * from './services/error-recovery.service';
export * from './services/health-check.service';
export * from './services/monitoring.service';
export * from './services/sanitization.service';
export * from './services/security-audit.service';
export * from './services/sms-verification.service';
export * from './services/token-blacklist.service';
export * from './services/two-factor-auth.service';

// Card management services
export * from '../src/common/services/encryption.service';
export * from '../src/common/services/request-context.service';

@Global()
@Module({
  imports: [
    // JWT Module configuration for TokenBlacklistService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('jwt.accessToken.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.accessToken.expiresIn'),
          issuer: configService.get('jwt.options.issuer'),
          audience: configService.get('jwt.options.audience')
        }
      }),
      inject: [ConfigService]
    }),
    // Import UsersModule to access UsersService for SMS verification
    forwardRef(() => UsersModule)
  ],
  providers: [
    // Global Response Transform Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor
    },

    // Global Filters
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    },

    // Global Enhanced Throttler Guard (per-user/IP rate limiting)
    {
      provide: APP_GUARD,
      useClass: EnhancedThrottlerGuard
    },

    // Make guards available for injection
    JwtAuthGuard,
    RolesGuard,
    EnhancedThrottlerGuard,
    TokenBlacklistGuard,
    TwoFactorAuthGuard,

    // Services
    SanitizationService,
    AdvancedRateLimiterService,
    SecurityAuditService,
    // DatabasePerformanceService, // Temporarily disabled - requires MongoDB auth
    EnhancedCacheService,
    MonitoringService,
    CircuitBreakerService,
    ErrorRecoveryService,
    HealthCheckService,
    TokenBlacklistService,
    TwoFactorAuthService,
    SmsVerificationService,
    EncryptionService,
    RequestContextService
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    EnhancedThrottlerGuard,
    TokenBlacklistGuard,
    TwoFactorAuthGuard,
    SanitizationService,
    AdvancedRateLimiterService,
    SecurityAuditService,
    // DatabasePerformanceService, // Temporarily disabled - requires MongoDB auth
    EnhancedCacheService,
    MonitoringService,
    CircuitBreakerService,
    ErrorRecoveryService,
    HealthCheckService,
    TokenBlacklistService,
    TwoFactorAuthService,
    SmsVerificationService,
    EncryptionService,
    RequestContextService
  ]
})
export class CommonModule {}
