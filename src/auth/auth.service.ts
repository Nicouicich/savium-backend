import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { AuthResponseDto, ChangePasswordDto, LoginDto, RegisterDto, SendSmsResponseDto } from './dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { JwtPayload, JwtRefreshPayload } from './strategies/jwt.strategy';
import { TokenBlacklistService } from '@common/services/token-blacklist.service';
import { SmsVerificationService } from '@common/services/sms-verification.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-codes';
import { UserDocument, UserMapper } from '../users';
import type { UserDocument as UserDocumentType } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly smsVerificationService: SmsVerificationService
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      // Create the user
      const user = await this.usersService.create(registerDto);

      if (!user) {
        throw new Error('User creation failed - no user returned');
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Token generation failed');
      }

      // Store refresh token
      await this.usersService.addRefreshToken(UserMapper.getMongoId(user), tokens.refreshToken);

      // Update last login
      await this.usersService.updateLastLogin(UserMapper.getMongoId(user));

      this.logger.log(`User registered successfully: ${user.email}`);

      return {
        user: user.toObject ? user.toObject() : user,
        tokens
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      // Check for database connection errors
      if (this.isDatabaseConnectionError(error)) {
        this.logger.error('Database connection failed during registration', error.stack);
        throw new ServiceUnavailableException('Database service is temporarily unavailable. Please try again later.');
      }

      this.logger.error(`Registration failed: ${error.message}`, error.stack);
      throw new BadRequestException('Registration failed');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    try {
      // Validate user credentials
      const user = await this.validateUser(loginDto.email, loginDto.password);

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      this.logger.debug(`Validated user: ${JSON.stringify(user)}`);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Token generation failed');
      }

      // Store refresh token
      await this.usersService.addRefreshToken(UserMapper.getMongoId(user), tokens.refreshToken);

      // Update last login
      await this.usersService.updateLastLogin(UserMapper.getMongoId(user));

      this.logger.log(`User logged in successfully: ${user.email}`);

      return {
        user,
        tokens
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Check for database connection errors
      if (this.isDatabaseConnectionError(error)) {
        this.logger.error('Database connection failed during login', error.stack);
        throw new ServiceUnavailableException('Database service is temporarily unavailable. Please try again later.');
      }

      this.logger.error(`Login failed: ${error.message}`, error.stack);
      throw new UnauthorizedException('Login failed');
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.refreshToken.secret')
      });

      // Find user by UUID and validate refresh token through UserAuthService
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Use the updated validation method from UserAuthService (convert UUID to MongoDB ID)
      const isValidToken = await this.usersService.validateRefreshToken(UserMapper.getMongoId(user), refreshToken);
      if (!isValidToken) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Remove old refresh token
      await this.usersService.removeRefreshToken(UserMapper.getMongoId(user), refreshToken);

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Token generation failed during refresh');
      }

      // Store new refresh token
      await this.usersService.addRefreshToken(UserMapper.getMongoId(user), tokens.refreshToken);

      this.logger.log(`Tokens refreshed for user: ${user.email}`);

      return {
        user: user.toObject ? user.toObject() : user,
        tokens
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Check for database connection errors
      if (this.isDatabaseConnectionError(error)) {
        this.logger.error('Database connection failed during token refresh', error.stack);
        throw new ServiceUnavailableException('Database service is temporarily unavailable. Please try again later.');
      }

      this.logger.warn(`Token refresh failed: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, accessToken?: string, refreshToken?: string): Promise<void> {
    // Blacklist the current access token if provided
    if (accessToken) {
      await this.tokenBlacklistService.blacklistToken(accessToken, userId, 'logout');
    }

    if (refreshToken) {
      // Remove specific refresh token
      await this.usersService.removeRefreshToken(userId, refreshToken);
    } else {
      // Remove all refresh tokens (logout from all devices)
      await this.usersService.clearAllRefreshTokens(userId);

      // If logging out from all devices, blacklist all tokens for this user
      await this.tokenBlacklistService.blacklistAllUserTokens(userId, 'logout');
    }

    this.logger.log(`User logged out: ${userId}`);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    // Get user with password directly (no need for separate findById call since JWT guard validates user exists)
    const userWithPassword = await this.usersService.findByIdWithPassword(userId);

    if (!userWithPassword) {
      throw new BadRequestException('User not found');
    }

    // Verify current password
    if (!userWithPassword.password) {
      throw new BadRequestException('User does not have a password set.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, userWithPassword.password);

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Check if new password is different
    const isSamePassword = await bcrypt.compare(changePasswordDto.newPassword, userWithPassword.password);

    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Update password (this will also clear all refresh tokens)
    await this.usersService.updatePassword(userId, changePasswordDto.newPassword);

    // Blacklist all existing access tokens for security
    await this.tokenBlacklistService.blacklistAllUserTokens(userId, 'password_change');

    this.logger.log(`Password changed for user: ${userId}`);
  }

  async validateOAuthUser(oauthData: {
    oauthProvider: string;
    oauthProviderId: string;
    email: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  }): Promise<any> {
    try {
      // Check if user exists with this OAuth provider
      let user = await this.usersService.findByOAuthProvider(oauthData.oauthProvider, oauthData.oauthProviderId);

      if (user) {
        // Update last login and return existing user
        await this.usersService.updateLastLogin(UserMapper.getMongoId(user));
        return user.toJSON();
      }

      // Check if user exists with this email (handle case where user doesn't exist)
      try {
        user = await this.usersService.findByEmail(oauthData.email);
      } catch (error) {
        if (error instanceof NotFoundException) {
          user = null; // User doesn't exist, we'll create a new one
        } else {
          throw error; // Re-throw other errors
        }
      }

      if (user) {
        // Link OAuth account to existing user
        await this.usersService.linkOAuthAccount(UserMapper.getMongoId(user), oauthData.oauthProvider, oauthData.oauthProviderId);
        await this.usersService.updateLastLogin(UserMapper.getMongoId(user));
        return user.toJSON();
      }

      // Create new user with OAuth data
      const newUser = await this.usersService.createFromOAuth({
        email: oauthData.email,
        firstName: oauthData.firstName,
        lastName: oauthData.lastName,
        oauthProvider: oauthData.oauthProvider,
        oauthProviderId: oauthData.oauthProviderId,
        isEmailVerified: true, // OAuth emails are considered verified
        avatar: oauthData.profilePicture
      });

      this.logger.log(`New OAuth user created: ${newUser.email} via ${oauthData.oauthProvider}`);

      return newUser.toJSON();
    } catch (error) {
      this.logger.error(`OAuth validation failed: ${error.message}`, error.stack);
      throw new BadRequestException('OAuth authentication failed');
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    try {
      const user = await this.usersService.findByEmailWithPassword(email);

      if (!user || !user.isActive) {
        return null;
      }

      // Check if user has a password
      if (!user.password) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      // Remove password from user object before returning
      const userObj = user.toJSON();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: userPassword, ...result } = userObj;
      return result;
    } catch {
      this.logger.warn(`User validation failed for email: ${email}`);
      return null;
    }
  }

  async generateTokens(user: any): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  }> {
    const payload: JwtPayload = {
      sub: user._id.toString(), // Use MongoDB ObjectId
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user._id.toString(), // Use MongoDB ObjectId
      email: user.email,
      role: user.role || 'USER', // Default role if not set
      tokenId: uuidv4(), // Unique identifier for this refresh token
      iat: Math.floor(Date.now() / 1000)
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.accessToken.secret'),
        expiresIn: this.configService.get('jwt.accessToken.expiresIn'),
        issuer: this.configService.get('jwt.options.issuer'),
        audience: this.configService.get('jwt.options.audience')
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get('jwt.refreshToken.secret'),
        expiresIn: this.configService.get('jwt.refreshToken.expiresIn'),
        issuer: this.configService.get('jwt.options.issuer'),
        audience: this.configService.get('jwt.options.audience')
      })
    ]);

    // Calculate expiration time for access token
    const expiresIn = new Date(Date.now() + this.parseExpirationTime(this.configService.get('jwt.accessToken.expiresIn') || '15m')).toISOString();

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  private parseExpirationTime(expiration: string): number {
    // Parse expiration strings like '15m', '7d', '1h'
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000; // Default to 15 minutes

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
        return 15 * 60 * 1000;
    }
  }

  /**
   * Send SMS verification code
   */
  async sendSmsVerification(userId: string | undefined, phoneNumber: string): Promise<SendSmsResponseDto> {
    this.logger.log('Sending SMS verification code', {
      userId: userId || 'anonymous',
      phoneNumber: this.maskPhoneNumber(phoneNumber)
    });

    try {
      // Send SMS verification code using the SMS service
      const result = await this.smsVerificationService.sendVerificationCode(phoneNumber, userId);

      this.logger.log('SMS verification code sent successfully', {
        userId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        verificationId: result.verificationId,
        expiresAt: result.expiresAt
      });

      // In development mode, the phone is already auto-verified by the SMS service
      const isDevelopment = this.configService.get('NODE_ENV') === 'development';

      return {
        success: result.success,
        message: isDevelopment ? 'Verification code sent and phone auto-verified in development' : result.message,
        verificationId: result.verificationId,
        expiresAt: result.expiresAt,
        messageId: result.messageId
      };
    } catch (error) {
      this.logger.error('Failed to send SMS verification code', {
        userId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        error: error.message,
        stack: error.stack
      });

      // Re-throw BusinessException as-is
      if (error instanceof BusinessException) {
        throw error;
      }

      throw new BusinessException('Failed to send verification code', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR);
    }
  }

  /**
   * Register user with phone verification
   */

  /**
   * Verify phone number for existing user
   */
  async verifyUserPhone(
    userId: string,
    verifyPhoneDto: VerifyPhoneDto
  ): Promise<{
    success: boolean;
    message: string;
    phoneNumber: string;
  }> {
    this.logger.log('Phone verification for existing user', {
      userId,
      phoneNumber: this.maskPhoneNumber(verifyPhoneDto.phoneNumber),
      verificationId: verifyPhoneDto.verificationId
    });

    try {

      // Verify the SMS code using the SMS verification service
      const verificationResult = await this.smsVerificationService.verifyCode(
        verifyPhoneDto.phoneNumber,
        verifyPhoneDto.verificationId,
        verifyPhoneDto.verificationCode
      );

      if (!verificationResult.success) {
        throw new BusinessException('Phone verification failed', HttpStatus.BAD_REQUEST, ErrorCode.INVALID_VERIFICATION_CODE);
      }

      // Update user's phone verification status
      await this.usersService.updateUserPhone(userId, {
        phoneNumber: verifyPhoneDto.phoneNumber,
        isPhoneVerified: true,
        phoneVerifiedAt: new Date()
      });

      this.logger.log('Phone verification successful for existing user', {
        userId,
        phoneNumber: this.maskPhoneNumber(verifyPhoneDto.phoneNumber),
        verificationId: verifyPhoneDto.verificationId
      });

      return {
        success: true,
        message: 'Phone number verified successfully',
        phoneNumber: verifyPhoneDto.phoneNumber
      };
    } catch (error) {
      this.logger.error('Phone verification failed for existing user', {
        userId,
        error: error.message,
        phoneNumber: this.maskPhoneNumber(verifyPhoneDto.phoneNumber),
        verificationId: verifyPhoneDto.verificationId
      });

      if (error instanceof BusinessException) {
        throw error;
      }

      throw new BusinessException('Phone verification failed', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Remove phone verification for user
   */
  async removeUserPhone(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log('Removing phone verification for user', { userId });

    try {
      await this.usersService.updateUserPhone(userId, {
        phoneNumber: undefined,
        isPhoneVerified: false,
        phoneVerifiedAt: undefined
      });

      this.logger.log('Phone verification removed for user', { userId });

      return {
        success: true,
        message: 'Phone number removed successfully'
      };
    } catch (error) {
      this.logger.error('Failed to remove phone verification', {
        userId,
        error: error.message
      });

      throw new BusinessException('Failed to remove phone number', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR);
    }
  }

  /**
   * Mask phone number for logging (security)
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length < 4) {
      return '***';
    }
    const start = phoneNumber.substring(0, 2);
    const end = phoneNumber.substring(phoneNumber.length - 2);
    return `${start}***${end}`;
  }

  private isDatabaseConnectionError(error: any): boolean {
    // Check for MongoDB connection errors
    const mongoErrors = ['MongoServerSelectionError', 'MongoNetworkError', 'MongooseServerSelectionError', 'connect ECONNREFUSED'];

    return mongoErrors.some(errorType => error.name?.includes(errorType) || error.message?.includes(errorType) || error.constructor?.name?.includes(errorType));
  }
}
