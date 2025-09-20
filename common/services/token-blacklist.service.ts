import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Cache } from 'cache-manager';

export interface BlacklistedToken {
  jti?: string; // JWT ID
  token: string;
  blacklistedAt: Date;
  expiresAt: Date;
  userId: string;
  reason: 'logout' | 'password_change' | 'security_breach' | 'admin_action';
}

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly keyPrefix = 'blacklist:token:';

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
    private jwtService: JwtService
  ) {}

  /**
   * Add an access token to the blacklist
   */
  async blacklistToken(
    token: string,
    userId: string,
    reason: BlacklistedToken['reason'] = 'logout'
  ): Promise<void> {
    try {
      // Decode the token to get expiration and JTI
      const decoded = this.jwtService.decode(token) as any;

      if (!decoded || !decoded.exp) {
        this.logger.warn('Cannot blacklist token: invalid token structure');
        return;
      }

      const expiresAt = new Date(decoded.exp * 1000);
      const now = new Date();

      // Don't blacklist already expired tokens
      if (expiresAt <= now) {
        this.logger.debug('Token already expired, not adding to blacklist');
        return;
      }

      const blacklistedToken: BlacklistedToken = {
        jti: decoded.jti,
        token,
        blacklistedAt: now,
        expiresAt,
        userId,
        reason
      };

      // Calculate TTL in seconds (time until token expires)
      const ttlSeconds = Math.ceil((expiresAt.getTime() - now.getTime()) / 1000);

      // Store in Redis with TTL
      const key = this.getBlacklistKey(token);
      await this.cacheManager.set(key, blacklistedToken, ttlSeconds);

      // Also store by JTI if available for faster lookups
      if (decoded.jti) {
        const jtiKey = this.getJtiBlacklistKey(decoded.jti);
        await this.cacheManager.set(jtiKey, blacklistedToken, ttlSeconds);
      }

      this.logger.log(`Token blacklisted for user ${userId}`, {
        reason,
        expiresAt,
        jti: decoded.jti
      });
    } catch (error) {
      this.logger.error('Error blacklisting token', {
        error: error.message,
        userId,
        reason
      });
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const key = this.getBlacklistKey(token);
      const blacklistedData = await this.cacheManager.get<BlacklistedToken>(key);

      if (blacklistedData) {
        this.logger.debug('Token found in blacklist', {
          userId: blacklistedData.userId,
          reason: blacklistedData.reason,
          blacklistedAt: blacklistedData.blacklistedAt
        });
        return true;
      }

      // Also check by JTI if the token has one
      const decoded = this.jwtService.decode(token) as any;
      if (decoded?.jti) {
        const jtiKey = this.getJtiBlacklistKey(decoded.jti);
        const jtiBlacklistedData = await this.cacheManager.get<BlacklistedToken>(jtiKey);
        return !!jtiBlacklistedData;
      }

      return false;
    } catch (error) {
      this.logger.error('Error checking token blacklist', error);
      // On error, allow the token (fail open for availability)
      return false;
    }
  }

  /**
   * Blacklist all tokens for a user (useful for password changes, security breaches)
   */
  async blacklistAllUserTokens(
    userId: string,
    reason: BlacklistedToken['reason'] = 'security_breach'
  ): Promise<void> {
    try {
      // In a real implementation, you would need to track active tokens per user
      // For now, we'll add a global blacklist entry for the user
      const key = this.getUserBlacklistKey(userId);
      const blacklistEntry = {
        userId,
        blacklistedAt: new Date(),
        reason,
        allTokens: true
      };

      // Set a long TTL (e.g., max JWT expiration time)
      const maxJwtTtlSeconds = this.configService.get<number>('jwt.accessToken.expiresIn') || 3600;
      await this.cacheManager.set(key, blacklistEntry, maxJwtTtlSeconds);

      this.logger.warn(`All tokens blacklisted for user ${userId}`, { reason });
    } catch (error) {
      this.logger.error('Error blacklisting all user tokens', {
        error: error.message,
        userId,
        reason
      });
    }
  }

  /**
   * Check if all tokens for a user are blacklisted
   */
  async areAllUserTokensBlacklisted(userId: string): Promise<boolean> {
    try {
      const key = this.getUserBlacklistKey(userId);
      const blacklistEntry = await this.cacheManager.get(key);
      return !!blacklistEntry;
    } catch (error) {
      this.logger.error('Error checking user blacklist', error);
      return false;
    }
  }

  /**
   * Remove a token from the blacklist (rarely needed)
   */
  async removeTokenFromBlacklist(token: string): Promise<void> {
    try {
      const key = this.getBlacklistKey(token);
      await this.cacheManager.del(key);

      // Also remove JTI entry if it exists
      const decoded = this.jwtService.decode(token) as any;
      if (decoded?.jti) {
        const jtiKey = this.getJtiBlacklistKey(decoded.jti);
        await this.cacheManager.del(jtiKey);
      }

      this.logger.log('Token removed from blacklist');
    } catch (error) {
      this.logger.error('Error removing token from blacklist', error);
    }
  }

  /**
   * Clear user-wide blacklist
   */
  async clearUserBlacklist(userId: string): Promise<void> {
    try {
      const key = this.getUserBlacklistKey(userId);
      await this.cacheManager.del(key);
      this.logger.log(`User blacklist cleared for ${userId}`);
    } catch (error) {
      this.logger.error('Error clearing user blacklist', error);
    }
  }

  /**
   * Get blacklist statistics
   */
  async getBlacklistStats(): Promise<{
    estimatedBlacklistedTokens: number;
    // Note: In a production environment, you'd want more sophisticated tracking
  }> {
    // This is a simplified implementation
    // In production, you might maintain counters or use Redis SCAN
    return {
      estimatedBlacklistedTokens: 0 // Would require more complex implementation
    };
  }

  /**
   * Cleanup expired blacklist entries (usually handled by Redis TTL)
   */
  async cleanupExpiredEntries(): Promise<void> {
    // Redis TTL handles this automatically, but you could implement
    // additional cleanup logic here if needed
    this.logger.debug('Blacklist cleanup completed (handled by Redis TTL)');
  }

  // Private helper methods
  private getBlacklistKey(token: string): string {
    // Use a hash of the token to avoid storing the full token in Redis keys
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    return `${this.keyPrefix}${tokenHash}`;
  }

  private getJtiBlacklistKey(jti: string): string {
    return `${this.keyPrefix}jti:${jti}`;
  }

  private getUserBlacklistKey(userId: string): string {
    return `${this.keyPrefix}user:${userId}`;
  }

  /**
   * Extract user ID from token (if possible)
   */
  private extractUserIdFromToken(token: string): string | null {
    try {
      const decoded = this.jwtService.decode(token) as any;
      return decoded?.sub || decoded?.userId || null;
    } catch {
      return null;
    }
  }
}
