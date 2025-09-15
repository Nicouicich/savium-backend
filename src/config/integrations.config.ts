import { registerAs } from '@nestjs/config';

export default registerAs('integrations', () => ({
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    maxTokens: 1000,
    temperature: 0.3,
    timeout: 30000 // 30 seconds
  },

  // WhatsApp Business API Configuration
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'savium-verify-token',
    webhookEndpoint: '/integrations/whatsapp/webhook',
    apiVersion: 'v18.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID
  },

  // Telegram Bot Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookEndpoint: '/integrations/telegram/webhook',
    apiUrl: 'https://api.telegram.org/bot',
    timeout: 30000,
    commands: [
      { command: 'start', description: 'Start using Savium AI bot' },
      { command: 'expense', description: 'Record a new expense' },
      { command: 'summary', description: 'Get expense summary' },
      { command: 'help', description: 'Show available commands' }
    ]
  },

  // AWS S3 Configuration
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    s3: {
      bucket: process.env.AWS_S3_BUCKET || 'savium',
      signedUrlExpiration: parseInt(process.env.AWS_S3_SIGNED_URL_EXPIRATION || '3600', 10), // 1 hour default
      maxFileSize: parseInt(process.env.AWS_S3_MAX_FILE_SIZE || '104857600', 10), // 100MB default
      allowedMimeTypes: ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4']
    }
  },

  // Email Configuration (for notifications)
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    from: process.env.EMAIL_FROM || 'noreply@savium.ai'
  }
}));
