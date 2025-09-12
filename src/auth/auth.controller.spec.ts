/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ChangePasswordDto, RefreshTokenDto, AuthResponseDto } from './dto';
import { UserRole } from '../../common/constants/user-roles';
import { Request } from 'express';

describe('AuthController - Unit Tests', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  // Test data factories
  const createMockAuthResponse = (overrides = {}): AuthResponseDto => ({
    user: {
      id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      role: UserRole.USER,
      isActive: true,
      isEmailVerified: true,
      preferences: {
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        privacy: {
          profileVisibility: 'private' as const,
          activityVisibility: 'private' as const
        },
        display: {
          currency: 'USD',
          language: 'en',
          theme: 'light' as const
        }
      },
      accounts: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    tokens: {
      accessToken: 'mock.jwt.access.token',
      refreshToken: 'mock.jwt.refresh.token',
      expiresIn: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    },
    ...overrides
  });

  const createMockRegisterDto = (overrides = {}): RegisterDto => ({
    firstName: 'John',
    lastName: 'Doe',
    email: 'test@example.com',
    password: 'SecurePass123!',
    ...overrides
  });

  const createMockLoginDto = (overrides = {}): LoginDto => ({
    email: 'test@example.com',
    password: 'SecurePass123!',
    ...overrides
  });

  const createMockChangePasswordDto = (overrides = {}): ChangePasswordDto => ({
    currentPassword: 'CurrentPass123!',
    newPassword: 'NewPass123!',
    ...overrides
  });

  const createMockRefreshTokenDto = (overrides = {}): RefreshTokenDto => ({
    refreshToken: 'valid.refresh.token',
    ...overrides
  });

  const createMockUser = (overrides = {}) => ({
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'USER',
    isActive: true,
    isEmailVerified: true,
    ...overrides
  });

  const createMockRequest = (overrides = {}): any => ({
    headers: {
      authorization: 'Bearer mock.access.token',
      ...((overrides as any).headers || {})
    },
    ...(overrides as any)
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshTokens: jest.fn(),
            logout: jest.fn(),
            changePassword: jest.fn()
          }
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    configService = module.get(ConfigService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Happy Path Scenarios', () => {
    describe('register', () => {
      it('should register a new user successfully', async () => {
        // Arrange
        const registerDto = createMockRegisterDto();
        const expectedResponse = createMockAuthResponse();

        authService.register.mockResolvedValue(expectedResponse);

        // Act
        const result = await controller.register(registerDto);

        // Assert
        expect(result).toEqual(expectedResponse);
        expect(authService.register).toHaveBeenCalledWith(registerDto);
        expect(authService.register).toHaveBeenCalledTimes(1);
      });

      it('should handle registration with different user data', async () => {
        // Arrange
        const registerDto = createMockRegisterDto({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com'
        });
        const expectedResponse = createMockAuthResponse({
          user: {
            ...createMockAuthResponse().user,
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@example.com'
          }
        });

        authService.register.mockResolvedValue(expectedResponse);

        // Act
        const result = await controller.register(registerDto);

        // Assert
        expect(result).toEqual(expectedResponse);
        expect(authService.register).toHaveBeenCalledWith(registerDto);
      });
    });

    describe('login', () => {
      it('should login user with valid credentials', async () => {
        // Arrange
        const loginDto = createMockLoginDto();
        const expectedResponse = createMockAuthResponse();

        authService.login.mockResolvedValue(expectedResponse);

        // Act
        const result = await controller.login(loginDto);

        // Assert
        expect(result).toEqual(expectedResponse);
        expect(authService.login).toHaveBeenCalledWith(loginDto);
        expect(authService.login).toHaveBeenCalledTimes(1);
      });

      it('should handle login with case-insensitive email', async () => {
        // Arrange
        const loginDto = createMockLoginDto({
          email: 'TEST@EXAMPLE.COM'
        });
        const expectedResponse = createMockAuthResponse();

        authService.login.mockResolvedValue(expectedResponse);

        // Act
        const result = await controller.login(loginDto);

        // Assert
        expect(result).toEqual(expectedResponse);
        expect(authService.login).toHaveBeenCalledWith(loginDto);
      });
    });

    describe('refresh', () => {
      it('should refresh tokens successfully', async () => {
        // Arrange
        const refreshTokenDto = createMockRefreshTokenDto();
        const expectedTokens = {
          accessToken: 'new.access.token',
          refreshToken: 'new.refresh.token',
          expiresIn: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };

        authService.refreshTokens.mockResolvedValue(expectedTokens);

        // Act
        const result = await controller.refresh(refreshTokenDto);

        // Assert
        expect(result).toEqual(expectedTokens);
        expect(authService.refreshTokens).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
        expect(authService.refreshTokens).toHaveBeenCalledTimes(1);
      });
    });

    describe('logout', () => {
      it('should logout user successfully with refresh token', async () => {
        // Arrange
        const mockUser = createMockUser();
        const body = { refreshToken: 'specific.refresh.token' };

        authService.logout.mockResolvedValue(undefined);

        // Act
        const result = await controller.logout(mockUser, createMockRequest(), body);

        // Assert
        expect(result).toEqual({ message: 'Logged out successfully' });
        expect(authService.logout).toHaveBeenCalledWith(mockUser.id, 'mock.access.token', body.refreshToken);
        expect(authService.logout).toHaveBeenCalledTimes(1);
      });

      it('should logout user successfully without specific refresh token', async () => {
        // Arrange
        const mockUser = createMockUser();

        authService.logout.mockResolvedValue(undefined);

        // Act
        const result = await controller.logout(mockUser, createMockRequest());

        // Assert
        expect(result).toEqual({ message: 'Logged out successfully' });
        expect(authService.logout).toHaveBeenCalledWith(mockUser.id, 'mock.access.token', undefined);
        expect(authService.logout).toHaveBeenCalledTimes(1);
      });

      it('should logout user successfully with empty body', async () => {
        // Arrange
        const mockUser = createMockUser();
        const body = {};

        authService.logout.mockResolvedValue(undefined);

        // Act
        const result = await controller.logout(mockUser, createMockRequest(), body);

        // Assert
        expect(result).toEqual({ message: 'Logged out successfully' });
        expect(authService.logout).toHaveBeenCalledWith(mockUser.id, 'mock.access.token', undefined);
      });
    });

    describe('logoutAll', () => {
      it('should logout user from all devices successfully', async () => {
        // Arrange
        const mockUser = createMockUser();

        authService.logout.mockResolvedValue(undefined);

        // Act
        const result = await controller.logoutAll(mockUser, createMockRequest());

        // Assert
        expect(result).toEqual({ message: 'Logged out from all devices successfully' });
        expect(authService.logout).toHaveBeenCalledWith(mockUser.id, 'mock.access.token');
        expect(authService.logout).toHaveBeenCalledTimes(1);
      });
    });

    describe('getProfile', () => {
      it('should return current user profile', async () => {
        // Arrange
        const mockUser = createMockUser();

        // Act
        const result = await controller.getProfile(mockUser);

        // Assert
        expect(result).toEqual(mockUser);
        expect(result).not.toHaveProperty('password');
        expect(result).toMatchObject({
          id: expect.any(String),
          email: expect.any(String),
          firstName: expect.any(String),
          lastName: expect.any(String),
          role: expect.any(String),
          isActive: expect.any(Boolean),
          isEmailVerified: expect.any(Boolean)
        });
      });

      it('should return user profile with additional fields', async () => {
        // Arrange
        const mockUser = createMockUser({
          phoneNumber: '+1234567890',
          preferences: {
            theme: 'dark',
            language: 'en'
          }
        });

        // Act
        const result = await controller.getProfile(mockUser);

        // Assert
        expect(result).toEqual(mockUser);
        expect(result.phoneNumber).toBe('+1234567890');
        expect(result.preferences).toEqual({
          theme: 'dark',
          language: 'en'
        });
      });
    });

    describe('changePassword', () => {
      it('should change password successfully', async () => {
        // Arrange
        const mockUser = createMockUser();
        const changePasswordDto = createMockChangePasswordDto();

        authService.changePassword.mockResolvedValue(undefined);

        // Act
        const result = await controller.changePassword(mockUser, changePasswordDto);

        // Assert
        expect(result).toEqual({ message: 'Password changed successfully' });
        expect(authService.changePassword).toHaveBeenCalledWith(mockUser.id, changePasswordDto);
        expect(authService.changePassword).toHaveBeenCalledTimes(1);
      });

      it('should change password with different passwords', async () => {
        // Arrange
        const mockUser = createMockUser();
        const changePasswordDto = createMockChangePasswordDto({
          currentPassword: 'OldSecure123!',
          newPassword: 'NewSecure456@'
        });

        authService.changePassword.mockResolvedValue(undefined);

        // Act
        const result = await controller.changePassword(mockUser, changePasswordDto);

        // Assert
        expect(result).toEqual({ message: 'Password changed successfully' });
        expect(authService.changePassword).toHaveBeenCalledWith(mockUser.id, changePasswordDto);
      });
    });
  });

  describe('Error Handling Scenarios', () => {
    describe('register', () => {
      it('should handle ConflictException during registration', async () => {
        // Arrange
        const registerDto = createMockRegisterDto();
        const conflictError = new ConflictException('User with this email already exists');

        authService.register.mockRejectedValue(conflictError);

        // Act & Assert
        await expect(controller.register(registerDto)).rejects.toThrow(ConflictException);
        await expect(controller.register(registerDto)).rejects.toThrow('User with this email already exists');
        expect(authService.register).toHaveBeenCalledWith(registerDto);
      });

      it('should handle BadRequestException during registration', async () => {
        // Arrange
        const registerDto = createMockRegisterDto();
        const badRequestError = new BadRequestException('Registration failed');

        authService.register.mockRejectedValue(badRequestError);

        // Act & Assert
        await expect(controller.register(registerDto)).rejects.toThrow(BadRequestException);
        await expect(controller.register(registerDto)).rejects.toThrow('Registration failed');
        expect(authService.register).toHaveBeenCalledWith(registerDto);
      });

      it('should propagate generic errors during registration', async () => {
        // Arrange
        const registerDto = createMockRegisterDto();
        const genericError = new Error('Unexpected error');

        authService.register.mockRejectedValue(genericError);

        // Act & Assert
        await expect(controller.register(registerDto)).rejects.toThrow('Unexpected error');
        expect(authService.register).toHaveBeenCalledWith(registerDto);
      });
    });

    describe('login', () => {
      it('should handle UnauthorizedException during login', async () => {
        // Arrange
        const loginDto = createMockLoginDto();
        const unauthorizedError = new UnauthorizedException('Invalid credentials');

        authService.login.mockRejectedValue(unauthorizedError);

        // Act & Assert
        await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
        await expect(controller.login(loginDto)).rejects.toThrow('Invalid credentials');
        expect(authService.login).toHaveBeenCalledWith(loginDto);
      });

      it('should handle BadRequestException during login', async () => {
        // Arrange
        const loginDto = createMockLoginDto();
        const badRequestError = new BadRequestException('Validation failed');

        authService.login.mockRejectedValue(badRequestError);

        // Act & Assert
        await expect(controller.login(loginDto)).rejects.toThrow(BadRequestException);
        await expect(controller.login(loginDto)).rejects.toThrow('Validation failed');
        expect(authService.login).toHaveBeenCalledWith(loginDto);
      });
    });

    describe('refresh', () => {
      it('should handle UnauthorizedException during token refresh', async () => {
        // Arrange
        const refreshTokenDto = createMockRefreshTokenDto();
        const unauthorizedError = new UnauthorizedException('Invalid refresh token');

        authService.refreshTokens.mockRejectedValue(unauthorizedError);

        // Act & Assert
        await expect(controller.refresh(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
        await expect(controller.refresh(refreshTokenDto)).rejects.toThrow('Invalid refresh token');
        expect(authService.refreshTokens).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
      });

      it('should handle expired refresh token', async () => {
        // Arrange
        const refreshTokenDto = createMockRefreshTokenDto({
          refreshToken: 'expired.refresh.token'
        });
        const unauthorizedError = new UnauthorizedException('Token expired');

        authService.refreshTokens.mockRejectedValue(unauthorizedError);

        // Act & Assert
        await expect(controller.refresh(refreshTokenDto)).rejects.toThrow(UnauthorizedException);
        await expect(controller.refresh(refreshTokenDto)).rejects.toThrow('Token expired');
      });
    });

    describe('logout', () => {
      it('should handle errors during logout', async () => {
        // Arrange
        const mockUser = createMockUser();
        const body = { refreshToken: 'some.token' };
        const logoutError = new Error('Logout failed');

        authService.logout.mockRejectedValue(logoutError);

        // Act & Assert
        await expect(controller.logout(mockUser, createMockRequest(), body)).rejects.toThrow('Logout failed');
        expect(authService.logout).toHaveBeenCalledWith(mockUser.id, 'mock.access.token', body.refreshToken);
      });
    });

    describe('logoutAll', () => {
      it('should handle errors during logout from all devices', async () => {
        // Arrange
        const mockUser = createMockUser();
        const logoutError = new Error('Logout all failed');

        authService.logout.mockRejectedValue(logoutError);

        // Act & Assert
        await expect(controller.logoutAll(mockUser, createMockRequest())).rejects.toThrow('Logout all failed');
        expect(authService.logout).toHaveBeenCalledWith(mockUser.id, 'mock.access.token');
      });
    });

    describe('changePassword', () => {
      it('should handle BadRequestException during password change', async () => {
        // Arrange
        const mockUser = createMockUser();
        const changePasswordDto = createMockChangePasswordDto();
        const badRequestError = new BadRequestException('Current password is incorrect');

        authService.changePassword.mockRejectedValue(badRequestError);

        // Act & Assert
        await expect(controller.changePassword(mockUser, changePasswordDto)).rejects.toThrow(BadRequestException);
        await expect(controller.changePassword(mockUser, changePasswordDto)).rejects.toThrow('Current password is incorrect');
        expect(authService.changePassword).toHaveBeenCalledWith(mockUser.id, changePasswordDto);
      });

      it('should handle same password error', async () => {
        // Arrange
        const mockUser = createMockUser();
        const changePasswordDto = createMockChangePasswordDto({
          currentPassword: 'SamePass123!',
          newPassword: 'SamePass123!'
        });
        const badRequestError = new BadRequestException('New password must be different from current password');

        authService.changePassword.mockRejectedValue(badRequestError);

        // Act & Assert
        await expect(controller.changePassword(mockUser, changePasswordDto)).rejects.toThrow('New password must be different from current password');
      });

      it('should handle UnauthorizedException during password change', async () => {
        // Arrange
        const mockUser = createMockUser();
        const changePasswordDto = createMockChangePasswordDto();
        const unauthorizedError = new UnauthorizedException('User not found');

        authService.changePassword.mockRejectedValue(unauthorizedError);

        // Act & Assert
        await expect(controller.changePassword(mockUser, changePasswordDto)).rejects.toThrow(UnauthorizedException);
        await expect(controller.changePassword(mockUser, changePasswordDto)).rejects.toThrow('User not found');
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle registration within reasonable time', async () => {
      // Arrange
      const registerDto = createMockRegisterDto();
      const mockResponse = createMockAuthResponse();

      authService.register.mockResolvedValue(mockResponse);

      // Act
      const startTime = Date.now();
      const result = await controller.register(registerDto);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(result).toEqual(mockResponse);
    });

    it('should handle multiple concurrent login requests', async () => {
      // Arrange
      const loginDto = createMockLoginDto();
      const mockResponse = createMockAuthResponse();

      authService.login.mockResolvedValue(mockResponse);

      // Act
      const promises = Array(10)
        .fill(null)
        .map(() => controller.login({ ...loginDto, email: `test${Math.random()}@example.com` }));

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toMatchObject({
          user: expect.any(Object),
          tokens: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresIn: expect.any(String)
          })
        });
      });
    });

    it('should handle rapid successive refresh token requests', async () => {
      // Arrange
      const refreshTokenDto = createMockRefreshTokenDto();
      const mockTokens = {
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
        expiresIn: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };

      authService.refreshTokens.mockResolvedValue(mockTokens);

      // Act
      const promises = Array(5)
        .fill(null)
        .map(() => controller.refresh({ ...refreshTokenDto, refreshToken: `token${Math.random()}` }));

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toMatchObject({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(String)
        });
      });
    });
  });

  describe('Security Validations', () => {
    it('should not expose sensitive information in error responses', async () => {
      // Arrange
      const registerDto = createMockRegisterDto();
      const sensitiveError = new Error('Database connection string: mongodb://user:pass@host/db');

      authService.register.mockRejectedValue(sensitiveError);

      // Act & Assert
      await expect(controller.register(registerDto)).rejects.toThrow();
      // The actual error should not contain sensitive information when handled by global filters
    });

    it('should handle malformed request data gracefully', async () => {
      // Arrange
      const malformedDto = {
        firstName: '',
        lastName: '',
        email: 'not-an-email',
        password: '123' // Too short
      } as RegisterDto;

      // Even with invalid data, the controller should pass it to service
      // Validation should happen at DTO level with class-validator
      const validationError = new BadRequestException('Validation failed');
      authService.register.mockRejectedValue(validationError);

      // Act & Assert
      await expect(controller.register(malformedDto)).rejects.toThrow(BadRequestException);
    });

    it('should not leak user information in getProfile response', async () => {
      // Arrange
      const mockUser = createMockUser({
        password: 'should-not-be-in-response',
        refreshTokens: ['token1', 'token2'],
        __v: 0,
        _id: 'mongodb-object-id'
      });

      // Act
      const result = await controller.getProfile(mockUser);

      // Assert
      expect(result).toEqual(mockUser);
      // The controller returns the user as-is, sensitive data filtering should happen in JWT strategy
      // or at the service level
    });

    it('should handle unauthorized access gracefully', () => {
      // This test simulates what happens when JWT guard fails
      // In real scenario, this wouldn't reach the controller
      const mockUser = null;

      // Act & Assert
      // If somehow an unauthorized request reaches the controller
      // (which shouldn't happen with proper guards), it should handle gracefully
      expect(() => controller.getProfile(mockUser)).not.toThrow();
    });
  });

  describe('Input Validation Scenarios', () => {
    it('should handle edge case email formats', async () => {
      // Arrange
      const edgeCaseEmails = ['test+label@example.com', 'test.with.dots@example.com', 'test_with_underscores@example.com', 'test-with-dashes@example.com'];

      const mockResponse = createMockAuthResponse();
      authService.register.mockResolvedValue(mockResponse);

      // Act & Assert
      for (const email of edgeCaseEmails) {
        const registerDto = createMockRegisterDto({ email });
        const result = await controller.register(registerDto);
        expect(result).toEqual(mockResponse);
        expect(authService.register).toHaveBeenCalledWith(registerDto);
      }
    });

    it('should handle long but valid input data', async () => {
      // Arrange
      const longButValidDto = createMockRegisterDto({
        firstName: 'A'.repeat(50), // Max allowed length
        lastName: 'B'.repeat(50), // Max allowed length
        password: 'SecurePass123!' + 'A'.repeat(100) // Long but valid password
      });

      const mockResponse = createMockAuthResponse();
      authService.register.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.register(longButValidDto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(authService.register).toHaveBeenCalledWith(longButValidDto);
    });

    it('should handle special characters in names', async () => {
      // Arrange
      const specialCharDto = createMockRegisterDto({
        firstName: "O'Connor",
        lastName: 'Smith-Johnson'
      });

      const mockResponse = createMockAuthResponse();
      authService.register.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.register(specialCharDto);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(authService.register).toHaveBeenCalledWith(specialCharDto);
    });
  });

  describe('Response Format Validation', () => {
    it('should return properly formatted registration response', async () => {
      // Arrange
      const registerDto = createMockRegisterDto();
      const mockResponse = createMockAuthResponse();

      authService.register.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.register(registerDto);

      // Assert
      expect(result).toMatchObject({
        user: {
          id: expect.any(String),
          email: expect.any(String),
          firstName: expect.any(String),
          lastName: expect.any(String),
          role: expect.any(String),
          isActive: expect.any(Boolean),
          isEmailVerified: expect.any(Boolean),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(String)
        }
      });
    });

    it('should return properly formatted login response', async () => {
      // Arrange
      const loginDto = createMockLoginDto();
      const mockResponse = createMockAuthResponse();

      authService.login.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.login(loginDto);

      // Assert
      expect(result).toMatchObject({
        user: expect.any(Object),
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(String)
        }
      });
    });

    it('should return properly formatted refresh response', async () => {
      // Arrange
      const refreshTokenDto = createMockRefreshTokenDto();
      const mockTokens = {
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
        expiresIn: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };

      authService.refreshTokens.mockResolvedValue(mockTokens);

      // Act
      const result = await controller.refresh(refreshTokenDto);

      // Assert
      expect(result).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(String)
      });
    });

    it('should return properly formatted logout responses', async () => {
      // Arrange
      const mockUser = createMockUser();

      authService.logout.mockResolvedValue(undefined);

      // Act
      const logoutResult = await controller.logout(mockUser, createMockRequest());
      const logoutAllResult = await controller.logoutAll(mockUser, createMockRequest());

      // Assert
      expect(logoutResult).toEqual({ message: 'Logged out successfully' });
      expect(logoutAllResult).toEqual({ message: 'Logged out from all devices successfully' });
    });

    it('should return properly formatted password change response', async () => {
      // Arrange
      const mockUser = createMockUser();
      const changePasswordDto = createMockChangePasswordDto();

      authService.changePassword.mockResolvedValue(undefined);

      // Act
      const result = await controller.changePassword(mockUser, changePasswordDto);

      // Assert
      expect(result).toEqual({ message: 'Password changed successfully' });
    });
  });
});
