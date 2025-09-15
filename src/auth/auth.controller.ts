import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards, Req, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthResponseDto, ChangePasswordDto, LoginDto, RefreshTokenDto, RegisterDto } from './dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { ApiErrorResponse, ApiSuccessResponse } from '@common/decorators/api-response.decorator';

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
  async logout(@CurrentUser() user: any, @Req() req: Request, @Body() body?: { refreshToken?: string }) {
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
  async logoutAll(@CurrentUser() user: any, @Req() req: Request) {
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
        id: { type: 'string', example: '507f1f77bcf86cd799439011' },
        email: { type: 'string', example: 'john.doe@example.com' },
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        role: { type: 'string', example: 'user' },
        isActive: { type: 'boolean', example: true },
        isEmailVerified: { type: 'boolean', example: true }
      }
    }
  })
  @ApiErrorResponse(401, 'Unauthorized')
  getProfile(@CurrentUser() user: any) {
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
  async changePassword(@CurrentUser() user: any, @Body() changePasswordDto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, changePasswordDto);
    return { message: 'Password changed successfully' };
  }

  private extractTokenFromRequest(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}
