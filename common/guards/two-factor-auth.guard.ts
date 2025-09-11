import { Injectable, ExecutionContext, ForbiddenException, Logger, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TwoFactorAuthService } from '../services/two-factor-auth.service';

export const REQUIRE_2FA_KEY = 'require_2fa';

export interface Require2FAOptions {
  operation: string;
  skipIf?: (context: ExecutionContext) => boolean;
  gracePeriod?: number; // Minutes to allow operation without 2FA after login
  allowBackupCodes?: boolean;
}

export function Require2FA(options: Require2FAOptions | string) {
  const opts = typeof options === 'string' ? { operation: options } : options;
  return SetMetadata(REQUIRE_2FA_KEY, opts);
}

@Injectable()
export class TwoFactorAuthGuard {
  private readonly logger = new Logger(TwoFactorAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly twoFactorService: TwoFactorAuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const cls = context.getClass();

    // Get 2FA requirements from decorator
    const require2FAOptions = this.reflector.getAllAndOverride<Require2FAOptions>(
      REQUIRE_2FA_KEY,
      [handler, cls]
    );

    if (!require2FAOptions) {
      return true; // No 2FA required
    }

    // Skip if condition is met
    if (require2FAOptions.skipIf && require2FAOptions.skipIf(context)) {
      return true;
    }

    const user = (request as any).user;
    if (!user || !user.id) {
      throw new ForbiddenException('Authentication required');
    }

    const userId = user.id;

    try {
      // Check if user has 2FA enabled
      const has2FA = await this.twoFactorService.is2FAEnabled(userId);
      
      if (!has2FA) {
        // If 2FA is not enabled but required for this operation, deny access
        this.logger.warn(`2FA required but not enabled for user ${userId}`, {
          operation: require2FAOptions.operation,
          endpoint: `${request.method} ${request.path}`,
          userAgent: request.headers['user-agent']
        });

        throw new ForbiddenException(
          'Two-factor authentication is required for this operation. Please enable 2FA in your security settings.'
        );
      }

      // Check for 2FA verification in headers or body
      const twoFactorCode = this.extract2FACode(request);
      const extractedChallengeId = this.extractChallengeId(request);

      if (extractedChallengeId && twoFactorCode) {
        // Verify challenge-based 2FA
        const isValid = await this.twoFactorService.verifyChallenge(extractedChallengeId, twoFactorCode);
        
        if (!isValid) {
          this.logger.warn(`Invalid 2FA challenge response for user ${userId}`, {
            challengeId: extractedChallengeId,
            operation: require2FAOptions.operation
          });
          throw new ForbiddenException('Invalid two-factor authentication code');
        }

        this.logger.log(`2FA challenge verified for user ${userId}`, {
          operation: require2FAOptions.operation,
          challengeId: extractedChallengeId
        });

        return true;
      }

      if (twoFactorCode) {
        // Direct 2FA verification
        const verificationResult = await this.twoFactorService.verify2FA(
          userId,
          twoFactorCode,
          require2FAOptions.operation
        );

        if (!verificationResult.isValid) {
          this.logger.warn(`Invalid 2FA code for user ${userId}`, {
            operation: require2FAOptions.operation,
            remainingAttempts: verificationResult.remainingAttempts
          });

          const errorMessage = verificationResult.lockoutExpiresAt
            ? 'Too many failed attempts. Please try again later.'
            : `Invalid two-factor authentication code. ${verificationResult.remainingAttempts || 0} attempts remaining.`;

          throw new ForbiddenException(errorMessage);
        }

        this.logger.log(`2FA verified for user ${userId}`, {
          operation: require2FAOptions.operation
        });

        return true;
      }

      // Check for grace period (e.g., recently verified 2FA)
      if (require2FAOptions.gracePeriod) {
        const gracePeriodKey = `2fa_grace:${userId}`;
        // Implementation would check if user recently verified 2FA
        // For now, we'll require 2FA for all critical operations
      }

      // No 2FA code provided - create a challenge
      const challengeId = await this.twoFactorService.createChallenge(
        userId,
        require2FAOptions.operation
      );

      this.logger.warn(`2FA required for critical operation`, {
        userId,
        operation: require2FAOptions.operation,
        challengeId,
        endpoint: `${request.method} ${request.path}`
      });

      throw new ForbiddenException({
        code: 'TWO_FACTOR_REQUIRED',
        message: 'Two-factor authentication required for this operation',
        challengeId,
        operation: require2FAOptions.operation
      });

    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error('Error in 2FA guard', {
        error: error.message,
        userId,
        operation: require2FAOptions.operation
      });

      throw new ForbiddenException('Two-factor authentication verification failed');
    }
  }

  private extract2FACode(request: Request): string | null {
    // Check headers first
    const headerCode = request.headers['x-2fa-code'] as string;
    if (headerCode) {
      return headerCode;
    }

    // Check body for 2FA code
    const bodyCode = (request.body as any)?.twoFactorCode || (request.body as any)?.['2faCode'];
    if (bodyCode) {
      return bodyCode;
    }

    return null;
  }

  private extractChallengeId(request: Request): string | null {
    // Check headers first
    const headerChallengeId = request.headers['x-2fa-challenge-id'] as string;
    if (headerChallengeId) {
      return headerChallengeId;
    }

    // Check body for challenge ID
    const bodyChallengeId = (request.body as any)?.challengeId || (request.body as any)?.twoFactorChallengeId;
    if (bodyChallengeId) {
      return bodyChallengeId;
    }

    return null;
  }
}

// Convenience decorators for common critical operations
export const RequirePasswordChange2FA = () => Require2FA({
  operation: 'password_change',
  allowBackupCodes: true
});

export const RequireAccountSettings2FA = () => Require2FA({
  operation: 'account_settings',
  allowBackupCodes: true
});

export const RequireFinancialOperation2FA = () => Require2FA({
  operation: 'financial_operation',
  allowBackupCodes: false // More strict for financial operations
});

export const RequireDataExport2FA = () => Require2FA({
  operation: 'data_export',
  allowBackupCodes: true
});

export const RequireAdminOperation2FA = () => Require2FA({
  operation: 'admin_operation',
  allowBackupCodes: false
});