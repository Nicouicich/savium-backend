import {registerAs} from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10) || 3000,
  name: process.env.APP_NAME || 'Savium AI Backend',
  url: process.env.APP_URL || 'http://localhost:3000',

  // Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10) || 12,
  systemApiKey: process.env.SYSTEM_API_KEY || null,

  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10) || 10 * 1024 * 1024, // 10MB
  allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],

  // CORS
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  corsCredentials: process.env.CORS_CREDENTIALS === 'true',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'json'
}));
