import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  // Connection settings
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10) || 0,

  // Connection options
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,

  // URL format for external services (production)
  url: process.env.REDIS_URL,

  // Cache configuration
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '300', 10) || 300, // 5 minutes default
    maxItems: parseInt(process.env.CACHE_MAX_ITEMS || '1000', 10) || 1000
  },

  // Session configuration
  session: {
    prefix: 'savium:session:',
    ttl: 7 * 24 * 60 * 60 // 7 days
  },

  // Rate limiting configuration
  throttle: {
    prefix: 'savium:throttle:',
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10) || 100
  }
}));
