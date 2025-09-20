import { ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AdvancedRateLimiterService } from '../services/advanced-rate-limiter.service';
import { SanitizationService } from '../services/sanitization.service';

export const ENHANCED_THROTTLE_KEY = 'enhanced_throttle';

export interface EnhancedThrottleOptions {
  skipIf?: (context: ExecutionContext) => boolean;
  endpoint?: string;
  requireAuth?: boolean;
  financial?: boolean; // More restrictive for financial operations
  burst?: boolean; // Enable burst protection
}

export function EnhancedThrottle(options: EnhancedThrottleOptions = {}) {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(ENHANCED_THROTTLE_KEY, options, descriptor.value);
    } else {
      Reflect.defineMetadata(ENHANCED_THROTTLE_KEY, options, target);
    }
  };
}

@Injectable()
export class EnhancedThrottlerGuard {
  private readonly logger = new Logger(EnhancedThrottlerGuard.name);

  constructor(
    private readonly rateLimiter: AdvancedRateLimiterService,
    private readonly sanitization: SanitizationService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const cls = context.getClass();

    // Get enhanced throttle options
    const options = this.reflector.getAllAndOverride<EnhancedThrottleOptions>(
      ENHANCED_THROTTLE_KEY,
      [handler, cls]
    ) || {};

    // Skip if condition is met
    if (options.skipIf && options.skipIf(context)) {
      return true;
    }

    const ipAddress = this.sanitization.sanitizeIpAddress(request);
    const userId = (request as any).user?.id;
    const endpoint = options.endpoint || `${request.method}:${request.route?.path || request.path}`;

    try {
      // Check for temporary bans first
      const banCheck = await this.rateLimiter.checkSuspiciousActivity(userId || ipAddress);
      if (banCheck.isBanned) {
        this.logger.warn(`Request blocked - temporary ban in effect`, {
          identifier: userId || ipAddress,
          expiresAt: banCheck.banExpiresAt,
          endpoint
        });

        throw new HttpException({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. You have been temporarily banned.',
          retryAfter: banCheck.banExpiresAt ? Math.ceil((banCheck.banExpiresAt - Date.now()) / 1000) : 900
        }, HttpStatus.TOO_MANY_REQUESTS);
      }

      // Check whitelist
      if (userId && await this.rateLimiter.isWhitelisted(userId)) {
        return true;
      }

      const rateLimitChecks: Promise<any>[] = [];

      // 1. Burst protection (if enabled)
      if (options.burst) {
        rateLimitChecks.push(
          this.rateLimiter.checkBurstProtection(userId || ipAddress)
        );
      }

      // 2. IP-based rate limiting
      rateLimitChecks.push(
        this.rateLimiter.checkIpRateLimit(ipAddress)
      );

      // 3. User-based rate limiting (if authenticated)
      if (userId) {
        if (options.financial) {
          // More restrictive for financial operations
          const accountId = request.params?.accountId || request.body?.accountId;
          if (accountId) {
            rateLimitChecks.push(
              this.rateLimiter.checkFinancialTransactionRateLimit(userId, accountId)
            );
          }
        } else {
          rateLimitChecks.push(
            this.rateLimiter.checkUserRateLimit(userId, endpoint)
          );
        }
      }

      // 4. Endpoint-specific rate limiting
      rateLimitChecks.push(
        this.rateLimiter.checkEndpointRateLimit(endpoint, userId || ipAddress)
      );

      // Wait for all rate limit checks
      const results = await Promise.all(rateLimitChecks);

      // Find the most restrictive result
      const blockedResult = results.find(result => !result.allowed);

      if (blockedResult) {
        const identifier = userId || ipAddress;

        // Log the rate limit violation
        this.logger.warn(`Rate limit exceeded`, {
          identifier,
          endpoint,
          remainingRequests: blockedResult.remainingRequests,
          resetTime: new Date(blockedResult.resetTime).toISOString(),
          userAgent: request.headers['user-agent'],
          ip: ipAddress
        });

        // Detect abuse patterns and apply progressive penalties
        await this.rateLimiter.detectAbuse(identifier, endpoint);

        // Set rate limit headers
        const response = context.switchToHttp().getResponse();
        response.setHeader('X-RateLimit-Limit', '100'); // Could be made dynamic
        response.setHeader('X-RateLimit-Remaining', blockedResult.remainingRequests);
        response.setHeader('X-RateLimit-Reset', Math.ceil(blockedResult.resetTime / 1000));
        response.setHeader('Retry-After', Math.ceil((blockedResult.resetTime - Date.now()) / 1000));

        throw new HttpException({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((blockedResult.resetTime - Date.now()) / 1000),
          remaining: blockedResult.remainingRequests
        }, HttpStatus.TOO_MANY_REQUESTS);
      }

      // Set success rate limit headers
      const response = context.switchToHttp().getResponse();
      const successResult = results.find(result => result.allowed) || results[0];

      if (successResult) {
        response.setHeader('X-RateLimit-Remaining', successResult.remainingRequests);
        response.setHeader('X-RateLimit-Reset', Math.ceil(successResult.resetTime / 1000));
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Error in enhanced throttler guard', error);

      // On error, allow the request but log it (fail open for availability)
      return true;
    }
  }

  private getEndpointIdentifier(request: Request): string {
    return `${request.method}:${request.route?.path || request.path}`;
  }

  private extractUserContext(request: Request): {
    userId?: string;
    accountId?: string;
    role?: string;
  } {
    const user = (request as any).user;
    return {
      userId: user?.id,
      accountId: request.params?.accountId || request.body?.accountId,
      role: user?.role
    };
  }
}
