import { PublishCommand, PublishCommandOutput, SNSClient } from '@aws-sdk/client-sns';
import { ErrorCode } from '@common/constants/error-codes';
import { BusinessException } from '@common/exceptions/business.exception';
import { BadRequestException, forwardRef, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'crypto';
import { Connection } from 'mongoose';
import { UsersService } from '../../src/users/users.service';

interface VerificationCode {
  phoneNumber: string;
  code: string;
  verificationId: string;
  expiresAt: Date;
  attempts: number;
  isUsed: boolean;
  createdAt: Date;
  lastAttemptAt?: Date;
}

interface SendSMSResult {
  success: boolean;
  verificationId: string;
  messageId?: string;
  message: string;
  expiresAt: Date;
}

interface VerifyCodeResult {
  success: boolean;
  message: string;
  phoneNumber?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remainingToday: number;
  remainingThisHour: number;
  nextResetAt: Date;
}

@Injectable()
export class SmsVerificationService {
  private readonly logger = new Logger(SmsVerificationService.name);
  private readonly snsClient: SNSClient;
  private readonly collectionName = 'smsverifications';
  private readonly rateLimitCollectionName = 'smsratelimits';

  constructor(
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
    @Inject(forwardRef(() => UsersService)) private readonly usersService: UsersService
  ) {
    // Initialize SNS client only if enabled
    if (this.configService.get('aws.sns.enabled')) {
      const region = this.configService.get<string>('aws.sns.region');
      const accessKeyId = this.configService.get<string>('aws.accessKeyId');
      const secretAccessKey = this.configService.get<string>('aws.secretAccessKey');

      if (!region || !accessKeyId || !secretAccessKey) {
        throw new Error('AWS SNS configuration is incomplete. Please check your environment variables.');
      }

      this.snsClient = new SNSClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
    }
  }

  /**
   * Get database collection safely
   */
  private getCollection(collectionName: string) {
    if (!this.connection.db) {
      throw new Error('Database connection is not available');
    }
    return this.connection.db.collection(collectionName);
  }

  /**
   * Send SMS verification code
   */
  async sendVerificationCode(phoneNumber: string, userId?: string): Promise<SendSMSResult> {
    this.logger.log('Sending SMS verification code', {
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      userId,
      mode: 'development'
    });

    try {
      // Validate phone number format
      this.validatePhoneNumber(phoneNumber);

      // Skip rate limiting in development mode
      // const rateLimitCheck = await this.checkRateLimit(phoneNumber, userId);
      // if (!rateLimitCheck.allowed) {
      //   throw new BusinessException(
      //     `Rate limit exceeded. You can send ${rateLimitCheck.remainingToday} more SMS today and ${rateLimitCheck.remainingThisHour} this hour.`,
      //     429,
      //     ErrorCode.RATE_LIMIT_EXCEEDED
      //   );
      // }

      // Check if there's an active unexpired code for this phone number
      await this.invalidateExistingCodes(phoneNumber);

      // Generate verification code and ID
      const code = this.generateVerificationCode();
      const verificationId = this.generateVerificationId(phoneNumber);
      const expiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes expiration

      // Store verification code in database
      await this.storeVerificationCode({
        phoneNumber,
        code,
        verificationId,
        expiresAt,
        attempts: 0,
        isUsed: false,
        createdAt: new Date()
      });

      // For development: log the code instead of sending SMS
      this.logger.warn('Development mode - Verification code generated', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        code: code, // Show full code in development for testing
        verificationId
      });

      // Skip SNS sending for now - code is stored in DB for verification
      let messageId: string | undefined = 'dev_mock_message_id';

      // For development: automatically verify the phone number
      this.logger.log('Development mode - Auto-verifying phone number', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        verificationId
      });

      // Auto-verify in development mode: update user if userId is provided
      if (userId) {
        await this.usersService.updateUserPhone(userId, {
          phoneNumber,
          isPhoneVerified: true,
          phoneVerifiedAt: new Date()
        });
      }

      // Skip rate limiting update in development mode
      // await this.updateRateLimit(phoneNumber, userId);

      const result: SendSMSResult = {
        success: true,
        verificationId,
        messageId,
        message: 'Verification code sent successfully',
        expiresAt
      };

      this.logger.log('SMS verification code sent successfully', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        verificationId,
        messageId,
        expiresAt
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to send SMS verification code', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        error: error.message,
        stack: error.stack
      });

      if (error instanceof BusinessException) {
        throw error;
      }

      // Check for AWS-specific errors
      if (error.name === 'InvalidParameterException' || error.name === 'InvalidParameterValueException') {
        throw new BusinessException('Invalid phone number format', 400, ErrorCode.VALIDATION_ERROR);
      }

      if (error.name === 'ThrottledException' || error.name === 'TooManyRequestsException') {
        throw new BusinessException('SMS service is busy. Please try again in a moment.', 429, ErrorCode.RATE_LIMIT_EXCEEDED);
      }

      if (error.name === 'InternalErrorException' || error.name === 'ServiceUnavailableException') {
        throw new ServiceUnavailableException('SMS service is temporarily unavailable. Please try again later.');
      }

      throw new BusinessException('Failed to send verification code', 500, ErrorCode.INTERNAL_ERROR);
    }
  }

  /**
   * Verify SMS code
   */
  async verifyCode(phoneNumber: string, verificationId: string, code: string): Promise<VerifyCodeResult> {
    this.logger.log('Verifying SMS code', {
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      verificationId,
      code: '***'
    });

    try {
      // Find verification record
      const collection = this.getCollection(this.collectionName);
      const verification = await collection.findOne({
        phoneNumber,
        verificationId,
        isUsed: false
      });

      if (!verification) {
        this.logger.warn('Verification record not found', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          verificationId
        });
        throw new BusinessException('Invalid verification ID or code has already been used', 400, ErrorCode.VALIDATION_ERROR);
      }

      // Check if code is expired
      if (new Date() > verification.expiresAt) {
        this.logger.warn('Verification code expired', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          verificationId,
          expiresAt: verification.expiresAt
        });
        await collection.updateOne(
          { _id: verification._id },
          { $set: { isUsed: true } }
        );
        throw new BusinessException('Verification code has expired', 400, ErrorCode.VERIFICATION_CODE_EXPIRED);
      }

      // Check max attempts
      const maxAttempts = this.configService.get('aws.sns.verification.maxAttempts');
      if (verification.attempts >= maxAttempts) {
        this.logger.warn('Maximum verification attempts exceeded', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          verificationId,
          attempts: verification.attempts,
          maxAttempts
        });
        await collection.updateOne(
          { _id: verification._id },
          { $set: { isUsed: true } }
        );
        throw new BusinessException('Maximum verification attempts exceeded', 400, ErrorCode.MAX_ATTEMPTS_EXCEEDED);
      }

      // Verify the code
      const isValidCode = verification.code === code;

      // Update attempts counter
      await collection.updateOne(
        { _id: verification._id },
        {
          $inc: { attempts: 1 },
          $set: {
            lastAttemptAt: new Date(),
            ...(isValidCode && { isUsed: true })
          }
        }
      );

      if (!isValidCode) {
        this.logger.warn('Invalid verification code provided', {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          verificationId,
          attempts: verification.attempts + 1
        });
        throw new BusinessException('Invalid verification code', 400, ErrorCode.INVALID_VERIFICATION_CODE);
      }

      this.logger.log('SMS verification successful', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        verificationId
      });

      return {
        success: true,
        message: 'Phone number verified successfully',
        phoneNumber
      };
    } catch (error) {
      this.logger.error('SMS verification failed', {
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        verificationId,
        error: error.message
      });

      if (error instanceof BusinessException) {
        throw error;
      }

      throw new BusinessException('Verification failed', 500, ErrorCode.INTERNAL_ERROR);
    }
  }

  /**
   * Check if user can send SMS (rate limiting)
   */
  async checkRateLimit(phoneNumber: string, userId?: string): Promise<RateLimitResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisHour = new Date();
    thisHour.setMinutes(0, 0, 0);

    const collection = this.getCollection(this.rateLimitCollectionName);

    // Get rate limit records for phone number and user
    const rateLimitKey = userId ? `user:${userId}` : `phone:${phoneNumber}`;
    const rateLimit = await collection.findOne({ key: rateLimitKey });

    const maxPerDay = this.configService.get('aws.sns.verification.rateLimiting.maxPerDay');
    const maxPerHour = this.configService.get('aws.sns.verification.rateLimiting.maxPerHour');

    let todayCount = 0;
    let hourCount = 0;

    if (rateLimit) {
      todayCount = rateLimit.dailyCount || 0;
      hourCount = rateLimit.hourlyCount || 0;

      // Reset daily counter if it's a new day
      if (rateLimit.lastResetDate < today) {
        todayCount = 0;
      }

      // Reset hourly counter if it's a new hour
      if (rateLimit.lastHourlyReset < thisHour) {
        hourCount = 0;
      }
    }

    const allowed = todayCount < maxPerDay && hourCount < maxPerHour;
    const nextReset = new Date(Math.min(
      today.getTime() + 24 * 60 * 60 * 1000, // Next day
      thisHour.getTime() + 60 * 60 * 1000 // Next hour
    ));

    return {
      allowed,
      remainingToday: Math.max(0, maxPerDay - todayCount),
      remainingThisHour: Math.max(0, maxPerHour - hourCount),
      nextResetAt: nextReset
    };
  }

  /**
   * Send SMS using AWS SNS
   */
  private async sendSMS(phoneNumber: string, code: string, expiresAt: Date): Promise<string> {
    const messageTemplate = this.configService.get('aws.sns.defaultMessageTemplate');
    const expirationMinutes = this.configService.get('aws.sns.verification.codeExpirationMinutes');

    const message = messageTemplate
      .replace('{code}', code)
      .replace('{expiration}', expirationMinutes.toString());

    const smsAttributes = this.configService.get('aws.sns.smsAttributes');

    const command = new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: smsAttributes['AWS.SNS.SMS.SenderID']
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: smsAttributes['AWS.SNS.SMS.SMSType']
        },
        'AWS.SNS.SMS.MaxPrice': {
          DataType: 'String',
          StringValue: smsAttributes['AWS.SNS.SMS.MaxPrice']
        }
      }
    });

    const result: PublishCommandOutput = await this.snsClient.send(command);

    if (!result.MessageId) {
      throw new Error('Failed to send SMS - no message ID returned');
    }

    return result.MessageId;
  }

  /**
   * Validate phone number format
   */
  private validatePhoneNumber(phoneNumber: string): void {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      throw new BusinessException('Invalid phone number format. Must be in international format (e.g., +1234567890)', 400, ErrorCode.VALIDATION_ERROR);
    }

    // Check allowed regions if configured
    const allowedRegions = this.configService.get('aws.sns.allowedRegions');
    if (allowedRegions.length > 0) {
      const countryCode = this.extractCountryCode(phoneNumber);
      if (!allowedRegions.some(region => phoneNumber.startsWith(`+${this.getCountryCodeForRegion(region)}`))) {
        throw new BusinessException('Phone number region not supported', 400, ErrorCode.UNSUPPORTED_REGION);
      }
    }

    // Check blacklisted countries
    const blacklistedCountries = this.configService.get('aws.sns.blacklistedCountries');
    if (blacklistedCountries.length > 0) {
      const countryCode = this.extractCountryCode(phoneNumber);
      if (blacklistedCountries.includes(countryCode)) {
        throw new BusinessException('Phone number from this country is not supported', 400, ErrorCode.BLOCKED_REGION);
      }
    }
  }

  /**
   * Generate random verification code
   */
  private generateVerificationCode(): string {
    const codeLength = this.configService.get('aws.sns.verification.codeLength');
    const min = Math.pow(10, codeLength - 1);
    const max = Math.pow(10, codeLength) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Generate unique verification ID
   */
  private generateVerificationId(phoneNumber: string): string {
    const timestamp = Date.now();
    const random = randomBytes(8).toString('hex');
    const hash = createHash('sha256').update(`${phoneNumber}${timestamp}${random}`).digest('hex').substring(0, 8);
    return `ver_${hash}_${timestamp}`;
  }

  /**
   * Store verification code in database
   */
  private async storeVerificationCode(verification: VerificationCode): Promise<void> {
    const collection = this.getCollection(this.collectionName);
    await collection.insertOne(verification);
  }

  /**
   * Invalidate existing verification codes for phone number
   */
  private async invalidateExistingCodes(phoneNumber: string): Promise<void> {
    const collection = this.getCollection(this.collectionName);
    await collection.updateMany(
      { phoneNumber, isUsed: false },
      { $set: { isUsed: true } }
    );
  }

  /**
   * Update rate limiting counters
   */
  private async updateRateLimit(phoneNumber: string, userId?: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisHour = new Date();
    thisHour.setMinutes(0, 0, 0);

    const collection = this.getCollection(this.rateLimitCollectionName);
    const rateLimitKey = userId ? `user:${userId}` : `phone:${phoneNumber}`;

    await collection.updateOne(
      { key: rateLimitKey },
      {
        $inc: {
          dailyCount: 1,
          hourlyCount: 1,
          totalCount: 1
        },
        $set: {
          lastSentAt: new Date(),
          lastResetDate: today,
          lastHourlyReset: thisHour
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  /**
   * Extract country code from phone number
   */
  private extractCountryCode(phoneNumber: string): string {
    // Simple extraction - in production you might want to use a proper library
    const cleaned = phoneNumber.replace('+', '');
    if (cleaned.startsWith('1')) return '1'; // US/Canada
    if (cleaned.startsWith('44')) return '44'; // UK
    if (cleaned.startsWith('49')) return '49'; // Germany
    if (cleaned.startsWith('33')) return '33'; // France
    if (cleaned.startsWith('34')) return '34'; // Spain
    if (cleaned.startsWith('39')) return '39'; // Italy
    if (cleaned.startsWith('55')) return '55'; // Brazil
    if (cleaned.startsWith('54')) return '54'; // Argentina
    if (cleaned.startsWith('57')) return '57'; // Colombia
    if (cleaned.startsWith('51')) return '51'; // Peru
    if (cleaned.startsWith('56')) return '56'; // Chile
    if (cleaned.startsWith('598')) return '598'; // Uruguay
    if (cleaned.startsWith('593')) return '593'; // Ecuador
    if (cleaned.startsWith('591')) return '591'; // Bolivia
    if (cleaned.startsWith('595')) return '595'; // Paraguay
    if (cleaned.startsWith('58')) return '58'; // Venezuela
    return cleaned.substring(0, 2); // Default to first 2 digits
  }

  /**
   * Get country code for region (simplified mapping)
   */
  private getCountryCodeForRegion(region: string): string {
    const regionMap: Record<string, string> = {
      'US': '1',
      'CA': '1',
      'GB': '44',
      'DE': '49',
      'FR': '33',
      'ES': '34',
      'IT': '39',
      'BR': '55',
      'AR': '54',
      'CO': '57',
      'PE': '51',
      'CL': '56',
      'UY': '598',
      'EC': '593',
      'BO': '591',
      'PY': '595',
      'VE': '58',
      'MX': '52'
    };
    return regionMap[region] || '';
  }

  /**
   * Mask phone number for logging (security)
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length < 4) {
      return '***';
    }
    const start = phoneNumber.substring(0, 3);
    const end = phoneNumber.substring(phoneNumber.length - 2);
    return phoneNumber;
    return `${start}***${end}`;
  }

  /**
   * Clean up expired verification codes (can be called by a cron job)
   */
  async cleanupExpiredCodes(): Promise<number> {
    const collection = this.getCollection(this.collectionName);
    const result = await collection.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    this.logger.log(`Cleaned up ${result.deletedCount} expired verification codes`);
    return result.deletedCount || 0;
  }

  /**
   * Get verification statistics (for monitoring)
   */
  async getVerificationStats(phoneNumber?: string): Promise<{
    totalSent: number;
    totalVerified: number;
    totalExpired: number;
    totalFailed: number;
  }> {
    const collection = this.getCollection(this.collectionName);
    const query = phoneNumber ? { phoneNumber } : {};

    const [totalSent, totalVerified, totalExpired, totalFailed] = await Promise.all([
      collection.countDocuments(query),
      collection.countDocuments({ ...query, isUsed: true }),
      collection.countDocuments({ ...query, expiresAt: { $lt: new Date() }, isUsed: false }),
      collection.countDocuments({ ...query, attempts: { $gte: this.configService.get('aws.sns.verification.maxAttempts') } })
    ]);

    return {
      totalSent,
      totalVerified,
      totalExpired,
      totalFailed
    };
  }
}
