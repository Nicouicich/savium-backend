import { Module, Global } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Interceptors
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { ErrorHandlingInterceptor } from './interceptors/error-handling.interceptor';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { EnhancedThrottlerGuard } from './guards/enhanced-throttler.guard';
import { TokenBlacklistGuard } from './guards/token-blacklist.guard';
import { TwoFactorAuthGuard } from './guards/two-factor-auth.guard';

// Services
import { SanitizationService } from './services/sanitization.service';
import { AdvancedRateLimiterService } from './services/advanced-rate-limiter.service';
import { SecurityAuditService } from './services/security-audit.service';
import { DatabasePerformanceService } from './services/database-performance.service';
import { EnhancedCacheService } from './services/enhanced-cache.service';
import { MonitoringService } from './services/monitoring.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { ErrorRecoveryService } from './services/error-recovery.service';
import { HealthCheckService } from './services/health-check.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { TwoFactorAuthService } from './services/two-factor-auth.service';

// Filters
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

// Decorators - These don't need to be provided as they are imported directly
export * from './decorators/roles.decorator';
export * from './decorators/current-user.decorator';
export * from './decorators/api-response.decorator';
export * from './decorators/validation.decorator';

// Constants and Enums
export * from './constants/account-types';
export * from './constants/user-roles';
export * from './constants/expense-categories';

// Utils
export * from './utils/pagination.util';
export * from './utils/response.util';

// Services
export * from './services/sanitization.service';
export * from './services/advanced-rate-limiter.service';
export * from './services/security-audit.service';
export * from './services/database-performance.service';
export * from './services/enhanced-cache.service';
export * from './services/monitoring.service';
export * from './services/circuit-breaker.service';
export * from './services/error-recovery.service';
export * from './services/health-check.service';
export * from './services/token-blacklist.service';
export * from './services/two-factor-auth.service';
export * from './guards/two-factor-auth.guard';

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
    })
  ],
  providers: [
    // Global Response Transform Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },

    // Global Filters
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },

    // Global Enhanced Throttler Guard (per-user/IP rate limiting)
    {
      provide: APP_GUARD,
      useClass: EnhancedThrottlerGuard,
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
    DatabasePerformanceService,
    EnhancedCacheService,
    MonitoringService,
    CircuitBreakerService,
    ErrorRecoveryService,
    HealthCheckService,
    TokenBlacklistService,
    TwoFactorAuthService,
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
    DatabasePerformanceService,
    EnhancedCacheService,
    MonitoringService,
    CircuitBreakerService,
    ErrorRecoveryService,
    HealthCheckService,
    TokenBlacklistService,
    TwoFactorAuthService,
  ],
})
export class CommonModule {}