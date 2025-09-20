import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

import { ConfigService } from '@nestjs/config';
import { UserAuth, UserAuthDocument } from '../schemas/user-auth.schema';

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);

  constructor(
    @InjectModel(UserAuth.name) private readonly userAuthModel: Model<UserAuthDocument>,
    private readonly configService: ConfigService
  ) {}

  async createAuthRecord(userId: string): Promise<UserAuthDocument> {
    const authRecord = new this.userAuthModel({
      userId: userId,
      refreshTokens: [],
      isEmailVerified: false,
      failedLoginAttempts: 0,
      twoFactorEnabled: false,
      activeSessions: []
    });

    const saved = await authRecord.save();
    this.logger.log(`Auth record created for user: ${userId}`);
    return saved;
  }

  async findByUserId(userId: string): Promise<UserAuthDocument> {
    const authRecord = await this.userAuthModel.findOne({ userId: userId });
    if (!authRecord) {
      throw new NotFoundException('User auth record not found');
    }
    return authRecord;
  }

  // Refresh token management with TTL
  async addRefreshToken(userId: string, refreshToken: string, deviceInfo?: { userAgent?: string; ipAddress?: string; deviceId?: string }): Promise<void> {
    const refreshTokenTtl = this.configService.get<string>('jwt.refreshToken.expiresIn') || '7d';
    const expiresAt = new Date(Date.now() + this.parseExpirationTime(refreshTokenTtl));

    this.logger.debug(`Adding refresh token for user: ${userId}, token starts with: ${refreshToken.substring(0, 20)}...`);

    const result = await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $push: {
          refreshTokens: {
            token: refreshToken,
            expiresAt,
            createdAt: new Date(),
            userAgent: deviceInfo?.userAgent,
            ipAddress: deviceInfo?.ipAddress,
            deviceId: deviceInfo?.deviceId
          }
        },
        $set: { lastLoginAt: new Date() }
      }
    );

    this.logger.debug(`Update result: matchedCount=${result.matchedCount}, modifiedCount=${result.modifiedCount}`);
    this.logger.log(`Refresh token added for user: ${userId}, expires: ${expiresAt.toISOString()}`);
  }

  async removeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.userAuthModel.updateOne({ userId: userId }, { $pull: { refreshTokens: { token: refreshToken } } });

    this.logger.log(`Refresh token removed for user: ${userId}`);
  }

  async clearAllRefreshTokens(userId: string): Promise<void> {
    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $set: { refreshTokens: [] },
        $unset: { activeSessions: 1 }
      }
    );
    this.logger.log(`All refresh tokens cleared for user: ${userId}`);
  }

  async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    try {
      this.logger.log(`Validating refresh token for user: ${userId}`);
      const authRecord = await this.findByUserId(userId);
      this.logger.log(`Auth record found for user ${userId}, refreshTokens count: ${authRecord.refreshTokens?.length || 0}`);

      const tokenExists = authRecord.refreshTokens?.some(tokenData => {
        const isMatch = tokenData.token === refreshToken;
        const isValid = tokenData.expiresAt > new Date();
        this.logger.log(`Token match: ${isMatch}, valid: ${isValid}, expires: ${tokenData.expiresAt.toISOString()}`);
        return isMatch && isValid;
      }) || false;

      if (!tokenExists) {
        this.logger.warn(`Invalid or expired refresh token for user: ${userId}`);
        this.logger.log(`Provided token starts with: ${refreshToken.substring(0, 20)}...`);
      }

      return tokenExists;
    } catch (error) {
      this.logger.error(`Error validating refresh token for user ${userId}: ${error.message}`);
      return false;
    }
  }

  // Email verification
  async setEmailVerificationToken(userId: string, token: string): Promise<void> {
    await this.userAuthModel.updateOne({ userId: userId }, { $set: { emailVerificationToken: token } });
  }

  async verifyEmail(userId: string): Promise<void> {
    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $set: { isEmailVerified: true },
        $unset: { emailVerificationToken: 1 }
      }
    );
    this.logger.log(`Email verified for user: ${userId}`);
  }

  async findByEmailVerificationToken(token: string): Promise<UserAuthDocument | null> {
    return this.userAuthModel.findOne({ emailVerificationToken: token });
  }

  // Password reset
  async setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $set: {
          passwordResetToken: token,
          passwordResetExpires: expires
        }
      }
    );
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $unset: {
          passwordResetToken: 1,
          passwordResetExpires: 1
        }
      }
    );
  }

  async findByPasswordResetToken(token: string): Promise<UserAuthDocument | null> {
    return this.userAuthModel.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });
  }

  // Session management
  async createSession(
    userId: string,
    deviceInfo: {
      deviceId?: string;
      deviceName?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<void> {
    const deviceId = deviceInfo.deviceId || uuidv4();

    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $push: {
          activeSessions: {
            deviceId,
            deviceName: deviceInfo.deviceName,
            userAgent: deviceInfo.userAgent,
            ipAddress: deviceInfo.ipAddress,
            lastUsedAt: new Date(),
            isActive: true
          }
        }
      }
    );
  }

  async updateSessionActivity(userId: string, deviceId: string): Promise<void> {
    await this.userAuthModel.updateOne(
      {
        userId: userId,
        'activeSessions.deviceId': deviceId
      },
      {
        $set: {
          'activeSessions.$.lastUsedAt': new Date(),
          'activeSessions.$.isActive': true
        }
      }
    );
  }

  async revokeSession(userId: string, deviceId: string): Promise<void> {
    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $pull: {
          activeSessions: { deviceId }
        }
      }
    );
  }

  async getActiveSessions(userId: string): Promise<any[]> {
    const authRecord = await this.findByUserId(userId);
    return authRecord.activeSessions?.filter(session => session.isActive) || [];
  }

  // Security features
  async recordFailedLogin(userId: string): Promise<void> {
    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $inc: { failedLoginAttempts: 1 }
      }
    );
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $set: { failedLoginAttempts: 0 },
        $unset: { lockedUntil: 1 }
      }
    );
  }

  async lockAccount(userId: string, lockDurationMinutes: number = 30): Promise<void> {
    const lockUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);

    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $set: { lockedUntil: lockUntil }
      }
    );

    this.logger.warn(`Account locked for user: ${userId} until ${lockUntil.toISOString()}`);
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    const authRecord = await this.findByUserId(userId);
    return authRecord.lockedUntil ? authRecord.lockedUntil > new Date() : false;
  }

  // Two-factor authentication
  async enableTwoFactor(userId: string, secret: string, backupCodes: string[]): Promise<void> {
    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $set: {
          twoFactorEnabled: true,
          twoFactorSecret: secret,
          backupCodes
        }
      }
    );
    this.logger.log(`Two-factor authentication enabled for user: ${userId}`);
  }

  async disableTwoFactor(userId: string): Promise<void> {
    await this.userAuthModel.updateOne(
      { userId: userId },
      {
        $set: { twoFactorEnabled: false },
        $unset: {
          twoFactorSecret: 1,
          backupCodes: 1
        }
      }
    );
    this.logger.log(`Two-factor authentication disabled for user: ${userId}`);
  }

  async consumeBackupCode(userId: string, code: string): Promise<boolean> {
    const result = await this.userAuthModel.updateOne({ userId: userId }, { $pull: { backupCodes: code } });

    return result.modifiedCount > 0;
  }

  // Cleanup methods for maintenance
  async cleanupExpiredRefreshTokens(userId?: string): Promise<number> {
    const query = userId ? { userId: userId } : {};

    const result = await this.userAuthModel.updateMany(query, {
      $pull: {
        refreshTokens: {
          expiresAt: { $lt: new Date() }
        }
      }
    });

    this.logger.log(`Cleaned up expired refresh tokens. Modified ${result.modifiedCount} documents`);
    return result.modifiedCount;
  }

  async getRefreshTokenStats(userId: string): Promise<{
    total: number;
    expired: number;
    active: number;
  }> {
    const authRecord = await this.findByUserId(userId);
    const now = new Date();

    const total = authRecord.refreshTokens?.length || 0;
    const expired = authRecord.refreshTokens?.filter(token => token.expiresAt < now).length || 0;
    const active = total - expired;

    return { total, expired, active };
  }

  private parseExpirationTime(expiration: string): number {
    // Parse expiration strings like '15m', '7d', '1h'
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // Default to 7 days

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 's':
        return num * 1000;
      case 'm':
        return num * 60 * 1000;
      case 'h':
        return num * 60 * 60 * 1000;
      case 'd':
        return num * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}
