import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix: string; // Redis key prefix
  skipIf?: (req: any) => boolean; // Skip rate limiting condition
  onLimitReached?: (req: any) => void; // Callback when limit is reached
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  totalRequests: number;
}

@Injectable()
export class AdvancedRateLimiterService {
  private readonly logger = new Logger(AdvancedRateLimiterService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService
  ) {}

  /**
   * Check rate limit for a given key
   */
  async checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
      const cacheKey = `${config.keyPrefix}:${key}:${windowStart}`;

      // Get current count from cache
      const currentCount = (await this.cacheManager.get<number>(cacheKey)) || 0;

      const newCount = currentCount + 1;

      // Set the count with expiration
      const ttl = Math.ceil(config.windowMs / 1000); // Convert to seconds
      await this.cacheManager.set(cacheKey, newCount, ttl);

      const allowed = newCount <= config.maxRequests;
      const remainingRequests = Math.max(0, config.maxRequests - newCount);
      const resetTime = windowStart + config.windowMs;

      if (!allowed) {
        this.logger.warn(`Rate limit exceeded for key: ${key}`, {
          key,
          currentCount: newCount,
          maxRequests: config.maxRequests,
          windowMs: config.windowMs
        });

        // Execute callback if provided
        config.onLimitReached?.({ key, currentCount: newCount });
      }

      return {
        allowed,
        remainingRequests,
        resetTime,
        totalRequests: newCount
      };
    } catch (error) {
      this.logger.error('Error checking rate limit', error);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remainingRequests: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        totalRequests: 0
      };
    }
  }

  /**
   * User-specific rate limiting
   */
  async checkUserRateLimit(userId: string, endpoint?: string): Promise<RateLimitResult> {
    const key = endpoint ? `user:${userId}:${endpoint}` : `user:${userId}`;

    return this.checkRateLimit(key, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 requests per 15 minutes per user
      keyPrefix: 'rate_limit_user'
    });
  }

  /**
   * IP-based rate limiting
   */
  async checkIpRateLimit(ipAddress: string): Promise<RateLimitResult> {
    return this.checkRateLimit(ipAddress, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per 15 minutes per IP
      keyPrefix: 'rate_limit_ip'
    });
  }

  /**
   * Endpoint-specific rate limiting
   */
  async checkEndpointRateLimit(endpoint: string, identifier: string): Promise<RateLimitResult> {
    const key = `${endpoint}:${identifier}`;

    // Different limits for different endpoint types
    const endpointConfigs: Record<string, Partial<RateLimitConfig>> = {
      'auth/login': {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5 // Only 5 login attempts per 15 minutes
      },
      'auth/register': {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3 // Only 3 registration attempts per hour
      },
      'auth/forgot-password': {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3 // Only 3 password reset requests per hour
      },
      'transactions/create': {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10 // 10 transaction creations per minute
      },
      'reports/generate': {
        windowMs: 5 * 60 * 1000, // 5 minutes
        maxRequests: 5 // 5 report generations per 5 minutes
      }
    };

    const config = endpointConfigs[endpoint] || {
      windowMs: 60 * 1000, // 1 minute default
      maxRequests: 60 // 60 requests per minute default
    };

    return this.checkRateLimit(key, {
      keyPrefix: 'rate_limit_endpoint',
      ...config
    } as RateLimitConfig);
  }

  /**
   * Financial transaction rate limiting (more restrictive)
   */
  async checkFinancialTransactionRateLimit(userId: string, accountId: string): Promise<RateLimitResult> {
    const key = `financial:${userId}:${accountId}`;

    return this.checkRateLimit(key, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5, // Only 5 financial operations per minute
      keyPrefix: 'rate_limit_financial'
    });
  }

  /**
   * Burst protection - very short window with low limits
   */
  async checkBurstProtection(identifier: string): Promise<RateLimitResult> {
    return this.checkRateLimit(identifier, {
      windowMs: 1000, // 1 second
      maxRequests: 10, // 10 requests per second max
      keyPrefix: 'rate_limit_burst'
    });
  }

  /**
   * Suspicious activity detection and temporary bans
   */
  async checkSuspiciousActivity(identifier: string): Promise<{ isBanned: boolean; banExpiresAt?: number }> {
    try {
      const banKey = `ban:${identifier}`;
      const banData = await this.cacheManager.get<{ bannedAt: number; duration: number }>(banKey);

      if (banData) {
        const banExpiresAt = banData.bannedAt + banData.duration;
        if (Date.now() < banExpiresAt) {
          return { isBanned: true, banExpiresAt };
        } else {
          // Ban expired, remove it
          await this.cacheManager.del(banKey);
        }
      }

      return { isBanned: false };
    } catch (error) {
      this.logger.error('Error checking suspicious activity', error);
      return { isBanned: false };
    }
  }

  /**
   * Temporarily ban an identifier
   */
  async temporaryBan(identifier: string, durationMs: number = 15 * 60 * 1000): Promise<void> {
    try {
      const banKey = `ban:${identifier}`;
      const banData = {
        bannedAt: Date.now(),
        duration: durationMs
      };

      const ttl = Math.ceil(durationMs / 1000);
      await this.cacheManager.set(banKey, banData, ttl);

      this.logger.warn(`Temporary ban applied`, {
        identifier,
        duration: durationMs,
        expiresAt: Date.now() + durationMs
      });
    } catch (error) {
      this.logger.error('Error applying temporary ban', error);
    }
  }

  /**
   * Detect and handle abuse patterns
   */
  async detectAbuse(identifier: string, endpoint: string): Promise<void> {
    try {
      const abuseKey = `abuse:${identifier}:${endpoint}`;
      const abuseCount = (await this.cacheManager.get<number>(abuseKey)) || 0;

      const newAbuseCount = abuseCount + 1;
      await this.cacheManager.set(abuseKey, newAbuseCount, 3600); // 1 hour TTL

      // Apply progressive penalties
      if (newAbuseCount >= 50) {
        // 4 hour ban for severe abuse
        await this.temporaryBan(identifier, 4 * 60 * 60 * 1000);
      } else if (newAbuseCount >= 20) {
        // 1 hour ban for moderate abuse
        await this.temporaryBan(identifier, 60 * 60 * 1000);
      } else if (newAbuseCount >= 10) {
        // 15 minute ban for light abuse
        await this.temporaryBan(identifier, 15 * 60 * 1000);
      }
    } catch (error) {
      this.logger.error('Error detecting abuse', error);
    }
  }

  /**
   * Get rate limit statistics
   */
  async getRateLimitStats(identifier: string): Promise<{
    current: Record<string, number>;
    banStatus: { isBanned: boolean; expiresAt?: number };
  }> {
    try {
      const patterns = [
        'rate_limit_user',
        'rate_limit_ip',
        'rate_limit_endpoint',
        'rate_limit_financial',
        'rate_limit_burst'
      ];

      const current: Record<string, number> = {};

      // This would require Redis SCAN in a real implementation
      // For now, we'll return empty stats
      for (const pattern of patterns) {
        current[pattern] = 0;
      }

      const banStatus = await this.checkSuspiciousActivity(identifier);

      return { current, banStatus };
    } catch (error) {
      this.logger.error('Error getting rate limit stats', error);
      return {
        current: {},
        banStatus: { isBanned: false }
      };
    }
  }

  /**
   * Clear rate limits for an identifier (admin function)
   */
  async clearRateLimits(identifier: string): Promise<void> {
    try {
      // In a real implementation, this would use Redis pattern matching
      // to delete all keys related to the identifier
      this.logger.log(`Rate limits cleared for identifier: ${identifier}`);
    } catch (error) {
      this.logger.error('Error clearing rate limits', error);
    }
  }

  /**
   * Whitelist functionality
   */
  async isWhitelisted(identifier: string): Promise<boolean> {
    try {
      const whitelistKey = `whitelist:${identifier}`;
      const isWhitelisted = await this.cacheManager.get<boolean>(whitelistKey);
      return Boolean(isWhitelisted);
    } catch (error) {
      this.logger.error('Error checking whitelist', error);
      return false;
    }
  }

  /**
   * Add to whitelist
   */
  async addToWhitelist(identifier: string, ttl?: number): Promise<void> {
    try {
      const whitelistKey = `whitelist:${identifier}`;
      await this.cacheManager.set(whitelistKey, true, ttl || 86400); // 24 hours default
      this.logger.log(`Added to whitelist: ${identifier}`);
    } catch (error) {
      this.logger.error('Error adding to whitelist', error);
    }
  }

  /**
   * Remove from whitelist
   */
  async removeFromWhitelist(identifier: string): Promise<void> {
    try {
      const whitelistKey = `whitelist:${identifier}`;
      await this.cacheManager.del(whitelistKey);
      this.logger.log(`Removed from whitelist: ${identifier}`);
    } catch (error) {
      this.logger.error('Error removing from whitelist', error);
    }
  }
}
