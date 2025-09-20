import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache namespace for organization
  tags?: string[]; // Tags for cache invalidation
  compress?: boolean; // Compress large values
  fallback?: () => Promise<any>; // Fallback function if cache miss
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: number;
  hitRate: number;
}

@Injectable()
export class EnhancedCacheService {
  private readonly logger = new Logger(EnhancedCacheService.name);
  private readonly stats = {
    hits: 0,
    misses: 0
  };

  constructor (
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService
  ) {}

  /**
   * Get value from cache with enhanced options
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const namespacedKey = this.buildKey(key, options.namespace);
      const cached = await this.cacheManager.get<string>(namespacedKey);

      if (cached !== null && cached !== undefined) {
        this.stats.hits++;

        // Decompress if needed
        const value = options.compress ? await this.decompress(cached) : cached;

        // Parse JSON if it's a string
        return typeof value === 'string' ? JSON.parse(value) : value;
      }

      this.stats.misses++;

      // Execute fallback if provided
      if (options.fallback) {
        const fallbackValue = await options.fallback();
        if (fallbackValue !== null && fallbackValue !== undefined) {
          await this.set(key, fallbackValue, options);
          return fallbackValue;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with enhanced options
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const namespacedKey = this.buildKey(key, options.namespace);
      let serializedValue = JSON.stringify(value);

      // Compress large values
      if (options.compress || serializedValue.length > 1024) {
        serializedValue = await this.compress(serializedValue);
      }

      const ttl = options.ttl || this.getDefaultTTL();
      await this.cacheManager.set(namespacedKey, serializedValue, ttl);

      // Store tags for invalidation
      if (options.tags) {
        await this.storeTags(namespacedKey, options.tags);
      }
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete specific key from cache
   */
  async delete(key: string, namespace?: string): Promise<void> {
    try {
      const namespacedKey = this.buildKey(key, namespace);
      await this.cacheManager.del(namespacedKey);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Cache user-specific data
   */
  async cacheUserData<T>(userId: string, dataType: string, data: T, ttl = 900): Promise<void> {
    const key = `user:${userId}:${dataType}`;
    await this.set(key, data, { ttl, namespace: 'user' });
  }

  /**
   * Get user-specific cached data
   */
  async getUserData<T>(userId: string, dataType: string): Promise<T | null> {
    const key = `user:${userId}:${dataType}`;
    return this.get<T>(key, { namespace: 'user' });
  }

  /**
   * Cache account-specific data
   */
  async cacheAccountData<T>(accountId: string, dataType: string, data: T, ttl = 600): Promise<void> {
    const key = `account:${accountId}:${dataType}`;
    await this.set(key, data, { ttl, namespace: 'account', tags: [`account:${accountId}`] });
  }

  /**
   * Get account-specific cached data
   */
  async getAccountData<T>(accountId: string, dataType: string): Promise<T | null> {
    const key = `account:${accountId}:${dataType}`;
    return this.get<T>(key, { namespace: 'account' });
  }

  /**
   * Cache query results with automatic invalidation
   */
  async cacheQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(queryKey, options);

    if (cached !== null) {
      return cached;
    }

    const result = await queryFn();
    await this.set(queryKey, result, options);
    return result;
  }

  /**
   * Cache expensive calculations
   */
  async cacheCalculation<T>(
    calculationKey: string,
    calculationFn: () => Promise<T>,
    ttl = 1800 // 30 minutes
  ): Promise<T> {
    return this.cacheQuery(calculationKey, calculationFn, {
      ttl,
      namespace: 'calculations',
      compress: true
    });
  }

  /**
   * Cache budget calculations for better performance
   */
  async cacheBudgetCalculation(
    accountId: string,
    period: string,
    calculation: () => Promise<any>
  ): Promise<any> {
    const key = `budget:${accountId}:${period}`;
    return this.cacheCalculation(key, calculation);
  }

  /**
   * Cache transaction aggregations
   */
  async cacheTransactionAggregation(
    accountId: string,
    aggregationType: string,
    timeframe: string,
    aggregation: () => Promise<any>
  ): Promise<any> {
    const key = `transaction_agg:${accountId}:${aggregationType}:${timeframe}`;
    return this.cacheCalculation(key, aggregation);
  }

  /**
   * Cache report data with tags for easy invalidation
   */
  async cacheReport(
    reportId: string,
    accountId: string,
    reportData: any,
    ttl = 3600 // 1 hour
  ): Promise<void> {
    const key = `report:${reportId}`;
    await this.set(key, reportData, {
      ttl,
      namespace: 'reports',
      tags: [`account:${accountId}`, 'reports']
    });
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const associatedKeys = await this.cacheManager.get<string[]>(tagKey);

        if (associatedKeys && associatedKeys.length > 0) {
          await Promise.all(associatedKeys.map(key => this.cacheManager.del(key)));
          await this.cacheManager.del(tagKey);
        }
      }
    } catch (error) {
      this.logger.error('Error invalidating cache by tags:', error);
    }
  }

  /**
   * Invalidate all user-related cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.invalidateByTags([`user:${userId}`]);
  }

  /**
   * Invalidate all account-related cache
   */
  async invalidateAccountCache(accountId: string): Promise<void> {
    await this.invalidateByTags([`account:${accountId}`]);
  }

  /**
   * Clear all cache (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.warn('All cache cleared');
    } catch (error) {
      this.logger.error('Error clearing all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      // This would depend on the cache implementation (Redis/Memory)
      // For now, return basic stats
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys: 0, // Would need specific implementation
        memory: 0, // Would need specific implementation
        hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys: 0,
        memory: 0,
        hitRate: 0
      };
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(): Promise<void> {
    try {
      this.logger.log('Starting cache warm-up...');

      // This would be implemented based on your specific needs
      // Examples:
      // - Pre-load active user sessions
      // - Pre-calculate common transaction aggregations
      // - Pre-load account settings

      this.logger.log('Cache warm-up completed');
    } catch (error) {
      this.logger.error('Error during cache warm-up:', error);
    }
  }

  /**
   * Implement cache-aside pattern for database queries
   */
  async cacheAside<T>(
    key: string,
    databaseQuery: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try cache first
    let data = await this.get<T>(key, options);

    if (data === null) {
      // Cache miss - fetch from database
      data = await databaseQuery();

      if (data !== null) {
        // Store in cache for next time
        await this.set(key, data, options);
      }
    }

    return data as T;
  }

  /**
   * Implement write-through cache pattern
   */
  async writeThrough<T>(
    key: string,
    data: T,
    databaseWrite: (data: T) => Promise<void>,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      // Write to database first
      await databaseWrite(data);

      // Then update cache
      await this.set(key, data, options);
    } catch (error) {
      this.logger.error(`Write-through cache error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Implement write-behind (write-back) cache pattern
   */
  async writeBehind<T>(
    key: string,
    data: T,
    databaseWrite: (data: T) => Promise<void>,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      // Update cache immediately
      await this.set(key, data, options);

      // Schedule database write (could use a queue in production)
      setImmediate(async () => {
        try {
          await databaseWrite(data);
        } catch (error) {
          this.logger.error(`Write-behind database write failed for key ${key}:`, error);
        }
      });
    } catch (error) {
      this.logger.error(`Write-behind cache error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  private async storeTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      const existingKeys = await this.cacheManager.get<string[]>(tagKey) || [];
      existingKeys.push(key);
      await this.cacheManager.set(tagKey, existingKeys, 86400); // 24 hours TTL for tags
    }
  }

  private getDefaultTTL(): number {
    return this.configService.get<number>('redis.cache.ttl') || 300; // 5 minutes
  }

  private async compress(data: string): Promise<string> {
    // In production, implement actual compression (e.g., gzip)
    // For now, just return the data as-is
    return data;
  }

  private async decompress(data: string): Promise<string> {
    // In production, implement actual decompression
    // For now, just return the data as-is
    return data;
  }

  /**
   * Cache health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      const testKey = 'health_check';
      const testValue = { timestamp: Date.now() };

      await this.set(testKey, testValue, { ttl: 30 });
      const retrieved = await this.get(testKey);

      if (JSON.stringify(retrieved) !== JSON.stringify(testValue)) {
        throw new Error('Cache read/write mismatch');
      }

      await this.delete(testKey);

      return {
        status: 'healthy',
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}