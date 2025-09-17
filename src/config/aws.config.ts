import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME,
    endpoint: process.env.AWS_S3_ENDPOINT, // For custom S3-compatible services
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
    uploadTimeout: parseInt(process.env.AWS_S3_UPLOAD_TIMEOUT || '60000'),
    maxFileSize: parseInt(process.env.AWS_S3_MAX_FILE_SIZE || '52428800'), // 50MB default
    allowedMimeTypes: (
      process.env.AWS_S3_ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/gif,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/mp4,application/pdf'
    ).split(','),
    presignedUrlExpiration: parseInt(process.env.AWS_S3_PRESIGNED_URL_EXPIRATION || '3600'), // 1 hour
    cdnDomain: process.env.AWS_S3_CDN_DOMAIN, // For CloudFront or custom CDN
    publicRead: process.env.AWS_S3_PUBLIC_READ === 'true',
    encryption: {
      enabled: process.env.AWS_S3_ENCRYPTION_ENABLED === 'true',
      algorithm: process.env.AWS_S3_ENCRYPTION_ALGORITHM || 'AES256',
      kmsKeyId: process.env.AWS_S3_KMS_KEY_ID
    },
    storageClass: process.env.AWS_S3_STORAGE_CLASS || 'STANDARD',
    lifecycle: {
      transitionToIA: parseInt(process.env.AWS_S3_TRANSITION_TO_IA || '30'), // days
      transitionToGlacier: parseInt(process.env.AWS_S3_TRANSITION_TO_GLACIER || '90'), // days
      expiration: parseInt(process.env.AWS_S3_EXPIRATION || '2555') // days (7 years for financial records)
    }
  },
  sns: {
    region: process.env.AWS_SNS_REGION || process.env.AWS_REGION || 'us-east-1',
    enabled: process.env.AWS_SNS_ENABLED === 'true',
    smsAttributes: {
      'AWS.SNS.SMS.SenderID': process.env.AWS_SNS_SENDER_ID || 'Savium',
      'AWS.SNS.SMS.SMSType': process.env.AWS_SNS_SMS_TYPE || 'Transactional', // Transactional or Promotional
      'AWS.SNS.SMS.MaxPrice': process.env.AWS_SNS_MAX_PRICE || '1.00' // Maximum price per SMS in USD
    },
    verification: {
      codeLength: parseInt(process.env.AWS_SNS_CODE_LENGTH || '6'),
      codeExpirationMinutes: parseInt(process.env.AWS_SNS_CODE_EXPIRATION || '5'),
      maxAttempts: parseInt(process.env.AWS_SNS_MAX_ATTEMPTS || '3'),
      cooldownMinutes: parseInt(process.env.AWS_SNS_COOLDOWN || '1'),
      rateLimiting: {
        maxPerDay: parseInt(process.env.AWS_SNS_MAX_PER_DAY || '10'),
        maxPerHour: parseInt(process.env.AWS_SNS_MAX_PER_HOUR || '5')
      }
    },
    allowedRegions: (process.env.AWS_SNS_ALLOWED_REGIONS || 'US,CA,MX,GB,DE,FR,ES,IT,BR,AR,CO,PE,CL,UY,EC,BO,PY,VE,SR,GY,GF').split(','),
    blacklistedCountries: (process.env.AWS_SNS_BLACKLISTED_COUNTRIES || '').split(',').filter(Boolean),
    defaultMessageTemplate: process.env.AWS_SNS_MESSAGE_TEMPLATE || 'Your Savium verification code is: {code}. Valid for {expiration} minutes.'
  }
}));
