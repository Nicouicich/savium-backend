import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { AuthResponseDto, ChangePasswordDto, LoginDto, RegisterDto } from './dto';
import { JwtPayload, JwtRefreshPayload } from './strategies/jwt.strategy';
import { TokenBlacklistService } from '@common/services/token-blacklist.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      // Create the user
      const user = await this.usersService.create(registerDto);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Store refresh token
      await this.usersService.addRefreshToken(user.id, tokens.refreshToken);

      // Update last login
      await this.usersService.updateLastLogin(user.id);

      this.logger.log(`User registered successfully: ${user.email}`);

      return {
        user: user.toJSON() as any,
        tokens
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Registration failed: ${error.message}`, error.stack);
      throw new BadRequestException('Registration failed');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Validate user credentials
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.debug(`Validated user: ${JSON.stringify(user)}`);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store refresh token
    await this.usersService.addRefreshToken(user.id, tokens.refreshToken);

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    this.logger.log(`User logged in successfully: ${user.email}`);

    return {
      user,
      tokens
    };
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: string }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.refreshToken.secret')
      });

      // Find user and validate refresh token through UserAuthService
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Use the updated validation method from UserAuthService
      const isValidToken = await this.usersService.validateRefreshToken(payload.sub, refreshToken);
      if (!isValidToken) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Remove old refresh token
      await this.usersService.removeRefreshToken(user.id, refreshToken);

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Store new refresh token
      await this.usersService.addRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`Tokens refreshed for user: ${user.email}`);

      return tokens;
    } catch (error) {
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
    // Get user with password
    const user = await this.usersService.findById(userId);
    const userWithPassword = await this.usersService.findByEmailWithPassword(user.email);

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

  async validateUser(email: string, password: string): Promise<any | null> {
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
      const { password: _, ...result } = userObj;
      return result;
    } catch {
      this.logger.warn(`User validation failed for email: ${email}`);
      return null;
    }
  }

  private async generateTokens(user: any): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  }> {
    const payload: JwtPayload = {
      sub: user.id || user._id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id || user._id,
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
}
