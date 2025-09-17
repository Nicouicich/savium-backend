import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { SmsVerificationService } from '../../../common/services/sms-verification.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-codes';

// Mock AWS SNS
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn().mockImplementation(() => ({
    send: mockSend
  })),
  PublishCommand: jest.fn()
}));

describe('SmsVerificationService', () => {
  let service: SmsVerificationService;
  let configService: ConfigService;
  let connection: Connection;
  let mockCollection: any;

  const mockConfig = {
    'aws.sns.enabled': true,
    'aws.sns.region': 'us-east-1',
    'aws.accessKeyId': 'mock-access-key',
    'aws.secretAccessKey': 'mock-secret-key',
    'aws.sns.verification.codeLength': 6,
    'aws.sns.verification.codeExpirationMinutes': 5,
    'aws.sns.verification.maxAttempts': 3,
    'aws.sns.verification.rateLimiting.maxPerDay': 10,
    'aws.sns.verification.rateLimiting.maxPerHour': 5,
    'aws.sns.allowedRegions': ['US', 'CA', 'GB'],
    'aws.sns.blacklistedCountries': [],
    'aws.sns.defaultMessageTemplate': 'Your Savium verification code is: {code}. Valid for {expiration} minutes.',
    'aws.sns.smsAttributes': {
      'AWS.SNS.SMS.SenderID': 'Savium',
      'AWS.SNS.SMS.SMSType': 'Transactional',
      'AWS.SNS.SMS.MaxPrice': '1.00'
    },
    NODE_ENV: 'test'
  };

  beforeEach(async () => {
    // Create mock collection with MongoDB-like interface
    mockCollection = {
      findOne: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      countDocuments: jest.fn()
    };

    // Create mock connection
    const mockConnection = {
      db: {
        collection: jest.fn().mockReturnValue(mockCollection)
      }
    };

    // Create mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => mockConfig[key])
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsVerificationService,
        {
          provide: ConfigService,
          useValue: mockConfigService
        },
        {
          provide: getConnectionToken(),
          useValue: mockConnection
        }
      ]
    }).compile();

    service = module.get<SmsVerificationService>(SmsVerificationService);
    configService = module.get<ConfigService>(ConfigService);
    connection = module.get<Connection>(getConnectionToken());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationCode', () => {
    const validPhoneNumber = '+1234567890';
    const userId = 'user123';

    beforeEach(() => {
      // Mock rate limit check to allow sending
      mockCollection.findOne.mockResolvedValue(null);
      mockCollection.insertOne.mockResolvedValue({ insertedId: 'verification123' });
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      // Mock SNS success response
      mockSend.mockResolvedValue({
        MessageId: 'sns-message-id-123'
      });
    });

    it('should send verification code successfully', async () => {
      const result = await service.sendVerificationCode(validPhoneNumber, userId);

      expect(result).toEqual({
        success: true,
        verificationId: expect.stringMatching(/^ver_[a-f0-9]{8}_\d+$/),
        messageId: 'sns-message-id-123',
        message: 'Verification code sent successfully',
        expiresAt: expect.any(Date)
      });

      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: validPhoneNumber,
          code: expect.stringMatching(/^\d{6}$/),
          verificationId: expect.stringMatching(/^ver_[a-f0-9]{8}_\d+$/),
          expiresAt: expect.any(Date),
          attempts: 0,
          isUsed: false,
          createdAt: expect.any(Date)
        })
      );

      expect(mockSend).toHaveBeenCalled();
    });

    it('should work in development mode without SNS', async () => {
      // Disable SNS for this test
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'aws.sns.enabled') return false;
        return mockConfig[key];
      });

      const result = await service.sendVerificationCode(validPhoneNumber, userId);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeUndefined();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should validate phone number format', async () => {
      const invalidPhone = '1234567890'; // Missing +

      await expect(service.sendVerificationCode(invalidPhone, userId)).rejects.toThrow(BusinessException);

      expect(mockCollection.insertOne).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should enforce rate limiting', async () => {
      // Mock existing rate limit that exceeds daily limit
      mockCollection.findOne.mockResolvedValue({
        key: `user:${userId}`,
        dailyCount: 10, // At daily limit
        hourlyCount: 2,
        lastResetDate: new Date(),
        lastHourlyReset: new Date()
      });

      await expect(service.sendVerificationCode(validPhoneNumber, userId)).rejects.toThrow(BusinessException);

      expect(mockCollection.insertOne).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should invalidate existing codes before creating new one', async () => {
      // Ensure SNS mock returns the expected result
      mockSend.mockResolvedValue({
        MessageId: 'sns-message-id-123'
      });

      await service.sendVerificationCode(validPhoneNumber, userId);

      expect(mockCollection.updateMany).toHaveBeenCalledWith({ phoneNumber: validPhoneNumber, isUsed: false }, { $set: { isUsed: true } });
    });

    it('should handle SNS errors gracefully', async () => {
      mockSend.mockRejectedValue(new Error('SNS Error'));

      await expect(service.sendVerificationCode(validPhoneNumber, userId)).rejects.toThrow(BusinessException);
    });

    it('should handle AWS throttling errors', async () => {
      const throttleError = new Error('Throttling');
      throttleError.name = 'ThrottledException';
      mockSend.mockRejectedValue(throttleError);

      await expect(service.sendVerificationCode(validPhoneNumber, userId)).rejects.toThrow(BusinessException);
    });
  });

  describe('verifyCode', () => {
    const phoneNumber = '+1234567890';
    const verificationId = 'ver_abc123_1234567890';
    const code = '123456';

    it('should verify code successfully', async () => {
      const mockVerification = {
        _id: 'verification-id',
        phoneNumber,
        verificationId,
        code,
        expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
        attempts: 0,
        isUsed: false,
        createdAt: new Date()
      };

      mockCollection.findOne.mockResolvedValue(mockVerification);
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.verifyCode(phoneNumber, verificationId, code);

      expect(result).toEqual({
        success: true,
        message: 'Phone number verified successfully',
        phoneNumber
      });

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: mockVerification._id },
        {
          $inc: { attempts: 1 },
          $set: {
            lastAttemptAt: expect.any(Date),
            isUsed: true
          }
        }
      );
    });

    it('should reject invalid verification ID', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      await expect(service.verifyCode(phoneNumber, 'invalid-id', code)).rejects.toThrow(BusinessException);
    });

    it('should reject expired verification code', async () => {
      const expiredVerification = {
        _id: 'verification-id',
        phoneNumber,
        verificationId,
        code,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        attempts: 0,
        isUsed: false,
        createdAt: new Date()
      };

      mockCollection.findOne.mockResolvedValue(expiredVerification);
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await expect(service.verifyCode(phoneNumber, verificationId, code)).rejects.toThrow(BusinessException);

      // Should mark as used when expired
      expect(mockCollection.updateOne).toHaveBeenCalledWith({ _id: expiredVerification._id }, { $set: { isUsed: true } });
    });

    it('should reject after maximum attempts', async () => {
      const maxAttemptsVerification = {
        _id: 'verification-id',
        phoneNumber,
        verificationId,
        code,
        expiresAt: new Date(Date.now() + 300000),
        attempts: 3, // At max attempts
        isUsed: false,
        createdAt: new Date()
      };

      mockCollection.findOne.mockResolvedValue(maxAttemptsVerification);
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await expect(service.verifyCode(phoneNumber, verificationId, code)).rejects.toThrow(BusinessException);

      // Should mark as used when max attempts reached
      expect(mockCollection.updateOne).toHaveBeenCalledWith({ _id: maxAttemptsVerification._id }, { $set: { isUsed: true } });
    });

    it('should reject invalid code and increment attempts', async () => {
      const mockVerification = {
        _id: 'verification-id',
        phoneNumber,
        verificationId,
        code: '654321', // Different code
        expiresAt: new Date(Date.now() + 300000),
        attempts: 1,
        isUsed: false,
        createdAt: new Date()
      };

      mockCollection.findOne.mockResolvedValue(mockVerification);
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await expect(service.verifyCode(phoneNumber, verificationId, code)).rejects.toThrow(BusinessException);

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: mockVerification._id },
        {
          $inc: { attempts: 1 },
          $set: {
            lastAttemptAt: expect.any(Date)
          }
        }
      );
    });
  });

  describe('checkRateLimit', () => {
    const phoneNumber = '+1234567890';
    const userId = 'user123';

    it('should allow sending when no rate limit record exists', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await service.checkRateLimit(phoneNumber, userId);

      expect(result.allowed).toBe(true);
      expect(result.remainingToday).toBe(10);
      expect(result.remainingThisHour).toBe(5);
    });

    it('should allow sending when under limits', async () => {
      const rateLimitRecord = {
        key: `user:${userId}`,
        dailyCount: 3,
        hourlyCount: 1,
        lastResetDate: new Date(),
        lastHourlyReset: new Date()
      };

      mockCollection.findOne.mockResolvedValue(rateLimitRecord);

      const result = await service.checkRateLimit(phoneNumber, userId);

      expect(result.allowed).toBe(true);
      expect(result.remainingToday).toBe(7);
      expect(result.remainingThisHour).toBe(4);
    });

    it('should block when daily limit exceeded', async () => {
      const rateLimitRecord = {
        key: `user:${userId}`,
        dailyCount: 10, // At daily limit
        hourlyCount: 2,
        lastResetDate: new Date(),
        lastHourlyReset: new Date()
      };

      mockCollection.findOne.mockResolvedValue(rateLimitRecord);

      const result = await service.checkRateLimit(phoneNumber, userId);

      expect(result.allowed).toBe(false);
      expect(result.remainingToday).toBe(0);
    });

    it('should block when hourly limit exceeded', async () => {
      const rateLimitRecord = {
        key: `user:${userId}`,
        dailyCount: 5,
        hourlyCount: 5, // At hourly limit
        lastResetDate: new Date(),
        lastHourlyReset: new Date()
      };

      mockCollection.findOne.mockResolvedValue(rateLimitRecord);

      const result = await service.checkRateLimit(phoneNumber, userId);

      expect(result.allowed).toBe(false);
      expect(result.remainingThisHour).toBe(0);
    });

    it('should reset daily counter for new day', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const rateLimitRecord = {
        key: `user:${userId}`,
        dailyCount: 10,
        hourlyCount: 2,
        lastResetDate: yesterday, // Yesterday
        lastHourlyReset: new Date()
      };

      mockCollection.findOne.mockResolvedValue(rateLimitRecord);

      const result = await service.checkRateLimit(phoneNumber, userId);

      expect(result.allowed).toBe(true);
      expect(result.remainingToday).toBe(10); // Reset to full limit
    });
  });

  describe('cleanupExpiredCodes', () => {
    it('should delete expired verification codes', async () => {
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 5 });

      const result = await service.cleanupExpiredCodes();

      expect(result).toBe(5);
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({
        expiresAt: { $lt: expect.any(Date) }
      });
    });

    it('should handle no expired codes', async () => {
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });

      const result = await service.cleanupExpiredCodes();

      expect(result).toBe(0);
    });
  });

  describe('getVerificationStats', () => {
    it('should return verification statistics', async () => {
      mockCollection.countDocuments
        .mockResolvedValueOnce(100) // totalSent
        .mockResolvedValueOnce(75) // totalVerified
        .mockResolvedValueOnce(10) // totalExpired
        .mockResolvedValueOnce(5); // totalFailed

      const result = await service.getVerificationStats();

      expect(result).toEqual({
        totalSent: 100,
        totalVerified: 75,
        totalExpired: 10,
        totalFailed: 5
      });
    });

    it('should return statistics for specific phone number', async () => {
      const phoneNumber = '+1234567890';

      mockCollection.countDocuments
        .mockResolvedValueOnce(10) // totalSent
        .mockResolvedValueOnce(8) // totalVerified
        .mockResolvedValueOnce(1) // totalExpired
        .mockResolvedValueOnce(1); // totalFailed

      const result = await service.getVerificationStats(phoneNumber);

      expect(result).toEqual({
        totalSent: 10,
        totalVerified: 8,
        totalExpired: 1,
        totalFailed: 1
      });

      // Verify queries include phone number filter
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({ phoneNumber });
    });
  });

  describe('private methods validation', () => {
    it('should validate phone number format correctly', async () => {
      const invalidPhones = [
        '1234567890', // Missing +
        '+', // Just +
        '+12345', // Too short
        '+123456789012345678', // Too long
        'abc', // Not a number
        '' // Empty
      ];

      for (const phone of invalidPhones) {
        await expect(service.sendVerificationCode(phone, 'user123')).rejects.toThrow(BusinessException);
      }
    });

    it('should generate verification codes of correct length', async () => {
      // Ensure SNS mock returns the expected result
      mockSend.mockResolvedValue({
        MessageId: 'sns-message-id-123'
      });

      // Reset mocks to capture fresh calls
      mockCollection.insertOne.mockClear();

      // We can't directly test private methods, but we can test the result
      const result = await service.sendVerificationCode('+1234567890', 'user123');

      // Verify that a 6-digit code was stored (we can check this through the database call)
      const insertCall = mockCollection.insertOne.mock.calls[0][0];
      expect(insertCall.code).toMatch(/^\d{6}$/);
    });

    it('should generate unique verification IDs', async () => {
      // Ensure SNS mock returns the expected result
      mockSend.mockResolvedValue({
        MessageId: 'sns-message-id-123'
      });

      const result1 = await service.sendVerificationCode('+1234567890', 'user1');
      const result2 = await service.sendVerificationCode('+1234567891', 'user2');

      expect(result1.verificationId).not.toBe(result2.verificationId);
      expect(result1.verificationId).toMatch(/^ver_[a-f0-9]{8}_\d+$/);
      expect(result2.verificationId).toMatch(/^ver_[a-f0-9]{8}_\d+$/);
    });
  });
});
