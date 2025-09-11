import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnhancedCacheService } from './enhanced-cache.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

export interface TwoFactorSecret {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  isVerified: boolean;
  createdAt: Date;
}

export interface TwoFactorVerificationResult {
  isValid: boolean;
  remainingAttempts?: number;
  lockoutExpiresAt?: Date;
}

export interface TwoFactorChallenge {
  challengeId: string;
  userId: string;
  operation: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
}

@Injectable()
export class TwoFactorAuthService {
  private readonly logger = new Logger(TwoFactorAuthService.name);
  private readonly secretLength = 32;
  private readonly windowSize = 2; // 30-second tolerance window
  private readonly maxAttempts = 3;
  private readonly challengeTtl = 300; // 5 minutes

  constructor(
    private readonly cacheService: EnhancedCacheService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Generate a new 2FA secret for a user
   */
  async generateSecret(userId: string, userEmail: string): Promise<TwoFactorSecret> {
    try {
      const appName = this.configService.get<string>('app.name') || 'Savium';
      
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${appName} (${userEmail})`,
        issuer: appName,
        length: this.secretLength
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      const twoFactorSecret: TwoFactorSecret = {
        secret: secret.base32!,
        qrCodeUrl,
        backupCodes,
        isVerified: false,
        createdAt: new Date()
      };

      // Store temporarily until verified
      await this.cacheService.set(
        `2fa_setup:${userId}`,
        twoFactorSecret,
        {
          ttl: 1800, // 30 minutes to complete setup
          namespace: '2fa',
          tags: [`user:${userId}`, '2fa_setup']
        }
      );

      this.logger.log(`2FA secret generated for user ${userId}`);

      return twoFactorSecret;
    } catch (error) {
      this.logger.error('Error generating 2FA secret', { error: error.message, userId });
      throw new BadRequestException('Failed to generate 2FA secret');
    }
  }

  /**
   * Verify 2FA token during setup
   */
  async verifySetup(userId: string, token: string): Promise<{ verified: boolean; backupCodes?: string[] }> {
    try {
      const setupData = await this.cacheService.get<TwoFactorSecret>(`2fa_setup:${userId}`);
      
      if (!setupData) {
        throw new BadRequestException('No 2FA setup in progress');
      }

      const isValid = this.verifyToken(setupData.secret, token);
      
      if (!isValid) {
        this.logger.warn(`Invalid 2FA token during setup for user ${userId}`);
        return { verified: false };
      }

      // Mark as verified and store permanently
      const verifiedSecret: TwoFactorSecret = {
        ...setupData,
        isVerified: true
      };

      await this.cacheService.set(
        `2fa_secret:${userId}`,
        verifiedSecret,
        {
          ttl: 0, // Permanent storage
          namespace: '2fa',
          tags: [`user:${userId}`, '2fa_secret']
        }
      );

      // Clear setup data
      await this.cacheService.delete(`2fa_setup:${userId}`, '2fa');

      this.logger.log(`2FA setup completed for user ${userId}`);

      return {
        verified: true,
        backupCodes: verifiedSecret.backupCodes
      };
    } catch (error) {
      this.logger.error('Error verifying 2FA setup', { error: error.message, userId });
      throw new BadRequestException('Failed to verify 2FA setup');
    }
  }

  /**
   * Verify 2FA token for authentication
   */
  async verify2FA(
    userId: string, 
    token: string, 
    operation: string = 'login'
  ): Promise<TwoFactorVerificationResult> {
    try {
      // Check for rate limiting
      const rateLimitKey = `2fa_attempts:${userId}`;
      const attempts = await this.cacheService.get<number>(rateLimitKey) || 0;
      
      if (attempts >= this.maxAttempts) {
        const lockoutExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        this.logger.warn(`2FA verification locked out for user ${userId}`, { attempts, operation });
        
        return {
          isValid: false,
          remainingAttempts: 0,
          lockoutExpiresAt
        };
      }

      const secretData = await this.cacheService.get<TwoFactorSecret>(`2fa_secret:${userId}`);
      
      if (!secretData || !secretData.isVerified) {
        throw new BadRequestException('2FA not enabled for this user');
      }

      // Check if it's a backup code
      const isBackupCode = this.verifyBackupCode(userId, token, secretData.backupCodes);
      
      // Verify TOTP token
      const isValidTotp = this.verifyToken(secretData.secret, token);
      
      const isValid = isValidTotp || isBackupCode;

      if (!isValid) {
        // Increment attempt counter
        await this.cacheService.set(rateLimitKey, attempts + 1, {
          ttl: 900, // 15 minutes
          namespace: '2fa'
        });

        this.logger.warn(`Invalid 2FA token for user ${userId}`, {
          operation,
          attempts: attempts + 1,
          remainingAttempts: this.maxAttempts - (attempts + 1)
        });

        return {
          isValid: false,
          remainingAttempts: this.maxAttempts - (attempts + 1)
        };
      }

      // Clear rate limiting on successful verification
      await this.cacheService.delete(rateLimitKey, '2fa');

      this.logger.log(`Successful 2FA verification for user ${userId}`, { operation });

      return { isValid: true };
    } catch (error) {
      this.logger.error('Error verifying 2FA', { error: error.message, userId, operation });
      throw new BadRequestException('2FA verification failed');
    }
  }

  /**
   * Create a 2FA challenge for critical operations
   */
  async createChallenge(userId: string, operation: string): Promise<string> {
    try {
      const challengeId = crypto.randomBytes(16).toString('hex');
      
      const challenge: TwoFactorChallenge = {
        challengeId,
        userId,
        operation,
        expiresAt: new Date(Date.now() + this.challengeTtl * 1000),
        attempts: 0,
        maxAttempts: this.maxAttempts
      };

      await this.cacheService.set(
        `2fa_challenge:${challengeId}`,
        challenge,
        {
          ttl: this.challengeTtl,
          namespace: '2fa',
          tags: [`user:${userId}`, '2fa_challenge']
        }
      );

      this.logger.log(`2FA challenge created for user ${userId}`, { operation, challengeId });

      return challengeId;
    } catch (error) {
      this.logger.error('Error creating 2FA challenge', { error: error.message, userId, operation });
      throw new BadRequestException('Failed to create 2FA challenge');
    }
  }

  /**
   * Verify 2FA challenge response
   */
  async verifyChallenge(challengeId: string, token: string): Promise<boolean> {
    try {
      const challenge = await this.cacheService.get<TwoFactorChallenge>(`2fa_challenge:${challengeId}`);
      
      if (!challenge) {
        throw new BadRequestException('Invalid or expired challenge');
      }

      if (challenge.attempts >= challenge.maxAttempts) {
        this.logger.warn(`2FA challenge max attempts exceeded`, { challengeId, userId: challenge.userId });
        await this.cacheService.delete(`2fa_challenge:${challengeId}`, '2fa');
        throw new UnauthorizedException('Too many failed attempts');
      }

      const verificationResult = await this.verify2FA(challenge.userId, token, challenge.operation);

      if (!verificationResult.isValid) {
        // Increment challenge attempts
        challenge.attempts++;
        await this.cacheService.set(
          `2fa_challenge:${challengeId}`,
          challenge,
          {
            ttl: this.challengeTtl,
            namespace: '2fa'
          }
        );

        return false;
      }

      // Clear challenge on success
      await this.cacheService.delete(`2fa_challenge:${challengeId}`, '2fa');

      this.logger.log(`2FA challenge verified successfully`, {
        challengeId,
        userId: challenge.userId,
        operation: challenge.operation
      });

      return true;
    } catch (error) {
      this.logger.error('Error verifying 2FA challenge', { error: error.message, challengeId });
      throw error;
    }
  }

  /**
   * Check if user has 2FA enabled
   */
  async is2FAEnabled(userId: string): Promise<boolean> {
    try {
      const secretData = await this.cacheService.get<TwoFactorSecret>(`2fa_secret:${userId}`);
      return !!(secretData && secretData.isVerified);
    } catch (error) {
      this.logger.error('Error checking 2FA status', { error: error.message, userId });
      return false;
    }
  }

  /**
   * Disable 2FA for a user
   */
  async disable2FA(userId: string): Promise<void> {
    try {
      await this.cacheService.delete(`2fa_secret:${userId}`, '2fa');
      await this.cacheService.delete(`2fa_setup:${userId}`, '2fa');
      
      // Clear any active challenges
      await this.cacheService.invalidateByTags([`user:${userId}`, '2fa_challenge']);

      this.logger.log(`2FA disabled for user ${userId}`);
    } catch (error) {
      this.logger.error('Error disabling 2FA', { error: error.message, userId });
      throw new BadRequestException('Failed to disable 2FA');
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    try {
      const secretData = await this.cacheService.get<TwoFactorSecret>(`2fa_secret:${userId}`);
      
      if (!secretData || !secretData.isVerified) {
        throw new BadRequestException('2FA not enabled for this user');
      }

      const newBackupCodes = this.generateBackupCodes();
      
      const updatedSecret: TwoFactorSecret = {
        ...secretData,
        backupCodes: newBackupCodes
      };

      await this.cacheService.set(
        `2fa_secret:${userId}`,
        updatedSecret,
        {
          ttl: 0, // Permanent
          namespace: '2fa',
          tags: [`user:${userId}`, '2fa_secret']
        }
      );

      this.logger.log(`Backup codes regenerated for user ${userId}`);

      return newBackupCodes;
    } catch (error) {
      this.logger.error('Error regenerating backup codes', { error: error.message, userId });
      throw new BadRequestException('Failed to regenerate backup codes');
    }
  }

  // Private helper methods
  private verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32' as speakeasy.Encoding,
      token,
      window: this.windowSize
    });
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private async verifyBackupCode(userId: string, code: string, backupCodes: string[]): Promise<boolean> {
    const upperCode = code.toUpperCase();
    const isValid = backupCodes.includes(upperCode);
    
    if (isValid) {
      // Remove used backup code
      const updatedCodes = backupCodes.filter(c => c !== upperCode);
      const secretData = await this.cacheService.get<TwoFactorSecret>(`2fa_secret:${userId}`);
      
      if (secretData) {
        const updatedSecret: TwoFactorSecret = {
          ...secretData,
          backupCodes: updatedCodes
        };

        await this.cacheService.set(
          `2fa_secret:${userId}`,
          updatedSecret,
          {
            ttl: 0,
            namespace: '2fa',
            tags: [`user:${userId}`, '2fa_secret']
          }
        );

        this.logger.log(`Backup code used for user ${userId}`);
      }
    }
    
    return isValid;
  }
}