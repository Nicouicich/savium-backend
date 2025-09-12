import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  // Access token configuration
  accessToken: {
    secret: process.env.JWT_ACCESS_SECRET || 'default-access-secret-change-in-production',
    expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m'
  },

  // Refresh token configuration
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
    expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d'
  },

  // JWT options
  options: {
    issuer: 'savium-ai',
    audience: 'savium-users',
    algorithm: 'HS256' as const
  },

  // Redis keys for token management
  redis: {
    refreshTokenPrefix: 'savium:refresh_token:',
    blacklistedTokenPrefix: 'savium:blacklisted:',
    userSessionPrefix: 'savium:user_session:'
  }
}));
