import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { ApiErrorResponse, ApiSuccessResponse } from '@common/decorators/api-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import type { UserForJWT, UserPublicInfo } from '../users/types';
import { UserMapper } from '../users/utils';
import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  ChangePasswordDto,
  LoginDto,
  PhoneRemovalResponseDto,
  PhoneVerificationResponseDto,
  RefreshTokenDto,
  RegisterDto,
  SendSmsDto,
  SendSmsResponseDto
} from './dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { FacebookOAuthGuard } from './guards/facebook-oauth.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiSuccessResponse(AuthResponseDto, 'User registered successfully')
  @ApiErrorResponse(400, 'Validation failed')
  @ApiErrorResponse(409, 'User already exists')
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    console.log('Register payload received:', registerDto);
    const result = await this.authService.register(registerDto);

    // Validate that we have the required data
    if (!result || !result.user || !result.tokens) {
      throw new Error('Registration completed but failed to generate complete response data');
    }

    return result;
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiSuccessResponse(AuthResponseDto, 'User logged in successfully')
  @ApiErrorResponse(401, 'Invalid credentials')
  @ApiErrorResponse(400, 'Validation failed')
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    const result = await this.authService.login(loginDto);

    // Validate that we have the required data
    if (!result || !result.user || !result.tokens) {
      throw new Error('Login completed but failed to generate complete response data');
    }

    return result;
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiSuccessResponse(AuthResponseDto, 'Tokens refreshed successfully')
  @ApiErrorResponse(401, 'Invalid refresh token')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    const result = await this.authService.refreshTokens(refreshTokenDto.refreshToken);

    // Validate that we have the required data
    if (!result || !result.user || !result.tokens) {
      throw new Error('Token refresh completed but failed to generate complete response data');
    }

    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user and invalidate refresh token' })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
    schema: { properties: { message: { type: 'string', example: 'Logged out successfully' } } }
  })
  @ApiErrorResponse(401, 'Unauthorized')
  async logout(@CurrentUser() user: UserForJWT, @Req() req: Request, @Body() body?: { refreshToken?: string }) {
    const accessToken = this.extractTokenFromRequest(req);
    await this.authService.logout(user.id, accessToken || undefined, body?.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout from all devices (invalidate all refresh tokens)' })
  @ApiResponse({
    status: 200,
    description: 'Logged out from all devices successfully',
    schema: { properties: { message: { type: 'string', example: 'Logged out from all devices successfully' } } }
  })
  @ApiErrorResponse(401, 'Unauthorized')
  async logoutAll(@CurrentUser() user: UserForJWT, @Req() req: Request) {
    const accessToken = this.extractTokenFromRequest(req);
    await this.authService.logout(user.id, accessToken || undefined);
    return { message: 'Logged out from all devices successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      properties: {
        id: { type: 'string', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
        email: { type: 'string', example: 'john.doe@example.com' },
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        fullName: { type: 'string', example: 'John Doe' },
        role: { type: 'string', example: 'user' },
        isActive: { type: 'boolean', example: true },
        isEmailVerified: { type: 'boolean', example: true }
      }
    }
  })
  @ApiErrorResponse(401, 'Unauthorized')
  getProfile(@CurrentUser() user: UserForJWT): UserForJWT {
    // Return the JWT user data directly
    // This already contains the UUID as id, which is what frontend expects
    return user;
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: { properties: { message: { type: 'string', example: 'Password changed successfully' } } }
  })
  @ApiErrorResponse(400, 'Current password is incorrect')
  @ApiErrorResponse(401, 'Unauthorized')
  async changePassword(@CurrentUser() user: UserForJWT, @Body() changePasswordDto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, changePasswordDto);
    return { message: 'Password changed successfully' };
  }

  // Google OAuth Routes
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @Public()
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth' })
  async googleAuth() {
    // Guard redirects to Google OAuth
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @Public()
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    try {
      this.logger.debug('Google OAuth callback triggered', {
        hasUser: !!req.user,
        query: req.query,
        userAgent: req.headers['user-agent']
      });

      const user = req.user;

      if (!user) {
        this.logger.error('No user object found in OAuth callback request');
        const frontendUrl = this.configService.get('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
        const errorUrl = `${frontendUrl}/auth/google/error?error=no_user`;
        return res.redirect(errorUrl);
      }

      this.logger.debug('Generating tokens for OAuth user', {
        userId: user.id,
        email: user.email
      });

      const tokens = await this.authService.generateTokens(user);

      if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
        this.logger.error('Failed to generate tokens for OAuth user', {
          hasTokens: !!tokens,
          hasAccessToken: !!tokens?.accessToken,
          hasRefreshToken: !!tokens?.refreshToken
        });
        const frontendUrl = this.configService.get('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
        const errorUrl = `${frontendUrl}/auth/google/error?error=token_generation_failed`;
        return res.redirect(errorUrl);
      }

      // Note: Token storage and last login update are handled within the OAuth validation process
      // These are managed by the UsersService through the validateOAuthUser method

      this.logger.log('Google OAuth authentication successful', {
        userId: user.id,
        email: user.email
      });

      // Redirect to frontend with tokens
      const frontendUrl = this.configService.get('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
      const redirectUrl = `${frontendUrl}/auth/google/success?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`;

      this.logger.debug('Redirecting to frontend', { redirectUrl: redirectUrl.substring(0, 100) + '...' });

      return res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error('Google OAuth callback failed', {
        error: error.message,
        stack: error.stack,
        hasUser: !!req.user,
        query: req.query
      });

      // Redirect to frontend with error
      const frontendUrl = this.configService.get('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
      const errorUrl = `${frontendUrl}/auth/google/error?error=callback_failed&message=${encodeURIComponent(error.message)}`;
      return res.redirect(errorUrl);
    }
  }

  // Facebook OAuth Routes
  @Get('facebook')
  @UseGuards(FacebookOAuthGuard)
  @Public()
  @ApiOperation({ summary: 'Initiate Facebook OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Facebook OAuth' })
  async facebookAuth() {
    // Guard redirects to Facebook OAuth
  }

  @Get('facebook/callback')
  @UseGuards(FacebookOAuthGuard)
  @Public()
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async facebookAuthCallback(@Req() req: Request, @Res() res: Response) {
    try {
      this.logger.debug('Facebook OAuth callback triggered', {
        hasUser: !!req.user,
        query: req.query,
        userAgent: req.headers['user-agent']
      });

      const user = req.user;

      if (!user) {
        this.logger.error('No user object found in OAuth callback request');
        const frontendUrl = this.configService.get('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
        const errorUrl = `${frontendUrl}/auth/facebook/error?error=no_user`;
        return res.redirect(errorUrl);
      }

      this.logger.debug('Generating tokens for OAuth user', {
        userId: user.id,
        email: user.email
      });

      const tokens = await this.authService.generateTokens(user);

      if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
        this.logger.error('Failed to generate tokens for OAuth user', {
          hasTokens: !!tokens,
          hasAccessToken: !!tokens?.accessToken,
          hasRefreshToken: !!tokens?.refreshToken
        });
        const frontendUrl = this.configService.get('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
        const errorUrl = `${frontendUrl}/auth/facebook/error?error=token_generation_failed`;
        return res.redirect(errorUrl);
      }

      // Note: Token storage and last login update are handled within the OAuth validation process
      // These are managed by the UsersService through the validateOAuthUser method

      this.logger.log('Facebook OAuth authentication successful', {
        userId: user.id,
        email: user.email
      });

      // Redirect to frontend with tokens
      const frontendUrl = this.configService.get('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
      const redirectUrl = `${frontendUrl}/auth/facebook/success?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`;

      this.logger.debug('Redirecting to frontend', { redirectUrl: redirectUrl.substring(0, 100) + '...' });

      return res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error('Facebook OAuth callback failed', {
        error: error.message,
        stack: error.stack,
        hasUser: !!req.user,
        query: req.query
      });

      // Redirect to frontend with error
      const frontendUrl = this.configService.get('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
      const errorUrl = `${frontendUrl}/auth/facebook/error?error=callback_failed&message=${encodeURIComponent(error.message)}`;
      return res.redirect(errorUrl);
    }
  }

  // Phone Verification Routes

  @Post('send-sms')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send SMS verification code',
    description: 'Send a verification code via SMS to the provided phone number for the authenticated user'
  })
  @ApiSuccessResponse(SendSmsResponseDto, 'SMS verification code sent successfully')
  @ApiErrorResponse(400, 'Invalid phone number or rate limit exceeded')
  @ApiErrorResponse(401, 'Unauthorized')
  @ApiErrorResponse(429, 'Rate limit exceeded')
  @ApiErrorResponse(503, 'SMS service unavailable')
  async sendSms(@CurrentUser() user: UserForJWT, @Body() sendSmsDto: SendSmsDto): Promise<SendSmsResponseDto> {
    this.logger.log('SMS send request', {
      userId: user.id,
      phoneNumber: this.maskPhoneNumber(sendSmsDto.phoneNumber)
    });

    return await this.authService.sendSmsVerification(user.id, sendSmsDto.phoneNumber);
  }

  @Post('verify-phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify phone number for existing user',
    description: 'Verify a phone number for an authenticated user using SMS verification code'
  })
  @ApiSuccessResponse(PhoneVerificationResponseDto, 'Phone number verified successfully')
  @ApiErrorResponse(400, 'Invalid verification code or phone number')
  @ApiErrorResponse(401, 'Unauthorized')
  async verifyPhone(
    @CurrentUser() user: UserForJWT,
    @Body() verifyPhoneDto: VerifyPhoneDto
  ): Promise<{
    success: boolean;
    message: string;
    phoneNumber: string;
  }> {
    this.logger.log('Phone verification request for existing user', {
      userId: user.id,
      phoneNumber: this.maskPhoneNumber(verifyPhoneDto.phoneNumber)
    });

    return await this.authService.verifyUserPhone(user.id, verifyPhoneDto);
  }

  @Post('remove-phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove phone number verification',
    description: 'Remove phone number verification for the authenticated user'
  })
  @ApiSuccessResponse(PhoneRemovalResponseDto, 'Phone number removed successfully')
  @ApiErrorResponse(401, 'Unauthorized')
  async removePhone(@CurrentUser() user: UserForJWT): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log('Phone removal request', { userId: user.id });
    return await this.authService.removeUserPhone(user.id);
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

  private extractTokenFromRequest(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}
