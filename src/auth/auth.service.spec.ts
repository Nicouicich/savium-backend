/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from './dto';
import { UserDocument } from '../users/schemas/user.schema';
import { UserRole } from '../../common/constants/user-roles';
import { TokenBlacklistService } from '../../common/services/token-blacklist.service';

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService - Unit Tests', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let tokenBlacklistService: jest.Mocked<any>;

  // Test data factories
  const createMockUser = (overrides = {}): Partial<UserDocument> => ({
    id: '507f1f77bcf86cd799439011',
    _id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: '$2b$10$hashedPassword',
    role: UserRole.USER,
    isActive: true,
    isEmailVerified: true,
    refreshTokens: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    toJSON: jest.fn().mockReturnValue({
      id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER,
      isActive: true,
      isEmailVerified: true
    }),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByEmailWithPassword: jest.fn(),
            addRefreshToken: jest.fn(),
            removeRefreshToken: jest.fn(),
            clearAllRefreshTokens: jest.fn(),
            validateRefreshToken: jest.fn(),
            updateLastLogin: jest.fn(),
            updatePassword: jest.fn()
          }
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verify: jest.fn()
          }
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn()
          }
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            blacklistToken: jest.fn(),
            blacklistAllUserTokens: jest.fn(),
            isTokenBlacklisted: jest.fn()
          }
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    tokenBlacklistService = module.get(TokenBlacklistService);

    // Setup default config service responses
    configService.get.mockImplementation((key: string) => {
      const config = {
        'jwt.accessToken.secret': 'access-secret',
        'jwt.refreshToken.secret': 'refresh-secret',
        'jwt.accessToken.expiresIn': '15m',
        'jwt.refreshToken.expiresIn': '7d',
        'jwt.options.issuer': 'savium',
        'jwt.options.audience': 'savium-app'
      };
      return config[key];
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Happy Path Scenarios', () => {
    describe('register', () => {
      it('should register a new user successfully', async () => {
        // Arrange
        const registerDto = createMockRegisterDto();
        const mockUser = createMockUser();
        const mockTokens = {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };

        usersService.create.mockResolvedValue(mockUser as UserDocument);
        jwtService.signAsync.mockResolvedValueOnce(mockTokens.accessToken);
        jwtService.signAsync.mockResolvedValueOnce(mockTokens.refreshToken);
        usersService.addRefreshToken.mockResolvedValue(undefined);
        usersService.updateLastLogin.mockResolvedValue(undefined);

        // Act
        const result = await service.register(registerDto);

        // Assert
        expect(result).toMatchObject({
          user: (mockUser as any).toJSON(),
          tokens: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresIn: expect.any(String)
          })
        });
        expect(usersService.create).toHaveBeenCalledWith(registerDto);
        expect(usersService.addRefreshToken).toHaveBeenCalledWith(mockUser.id, mockTokens.refreshToken);
        expect(usersService.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
      });

      it('should generate tokens with correct payload structure', async () => {
        // Arrange
        const registerDto = createMockRegisterDto();
        const mockUser = createMockUser();

        usersService.create.mockResolvedValue(mockUser as UserDocument);
        jwtService.signAsync.mockResolvedValue('mock-token');

        // Act
        await service.register(registerDto);

        // Assert
        expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

        // Check access token payload
        const accessTokenCall = jwtService.signAsync.mock.calls[0];
        expect(accessTokenCall[0]).toMatchObject({
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          iat: expect.any(Number)
        });

        // Check refresh token payload
        const refreshTokenCall = jwtService.signAsync.mock.calls[1];
        expect(refreshTokenCall[0]).toMatchObject({
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          tokenId: expect.any(String),
          iat: expect.any(Number)
        });
      });
    });

    describe('login', () => {
      it('should login user with valid credentials', async () => {
        // Arrange
        const loginDto = createMockLoginDto();
        const mockUser = createMockUser();
        const mockTokens = {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };

        jest.spyOn(service, 'validateUser').mockResolvedValue(mockUser);
        jwtService.signAsync.mockResolvedValueOnce(mockTokens.accessToken);
        jwtService.signAsync.mockResolvedValueOnce(mockTokens.refreshToken);
        usersService.addRefreshToken.mockResolvedValue(undefined);
        usersService.updateLastLogin.mockResolvedValue(undefined);

        // Act
        const result = await service.login(loginDto);

        // Assert
        expect(result).toMatchObject({
          user: mockUser,
          tokens: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresIn: expect.any(String)
          })
        });
        expect(service.validateUser).toHaveBeenCalledWith(loginDto.email, loginDto.password);
        expect(usersService.addRefreshToken).toHaveBeenCalledWith(mockUser.id, mockTokens.refreshToken);
        expect(usersService.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
      });
    });

    describe('refreshTokens', () => {
      it('should refresh tokens with valid refresh token', async () => {
        // Arrange
        const refreshToken = 'valid-refresh-token';
        const mockUser = createMockUser({
          refreshTokens: [refreshToken]
        });
        const mockPayload = {
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role
        };
        const newTokens = {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };

        jwtService.verify.mockReturnValue(mockPayload);
        usersService.findById.mockResolvedValue(mockUser as UserDocument);
        usersService.validateRefreshToken.mockResolvedValue(true);
        jwtService.signAsync.mockResolvedValueOnce(newTokens.accessToken);
        jwtService.signAsync.mockResolvedValueOnce(newTokens.refreshToken);
        usersService.removeRefreshToken.mockResolvedValue(undefined);
        usersService.addRefreshToken.mockResolvedValue(undefined);

        // Act
        const result = await service.refreshTokens(refreshToken);

        // Assert
        expect(result).toMatchObject({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(String)
        });
        expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, {
          secret: 'refresh-secret'
        });
        expect(usersService.removeRefreshToken).toHaveBeenCalledWith(mockUser.id, refreshToken);
        expect(usersService.addRefreshToken).toHaveBeenCalledWith(mockUser.id, newTokens.refreshToken);
      });
    });

    describe('logout', () => {
      it('should logout user by removing specific refresh token', async () => {
        // Arrange
        const userId = '507f1f77bcf86cd799439011';
        const accessToken = 'access-token';
        const refreshToken = 'refresh-token-to-remove';

        usersService.removeRefreshToken.mockResolvedValue(undefined);
        tokenBlacklistService.blacklistToken.mockResolvedValue(undefined);

        // Act
        await service.logout(userId, accessToken, refreshToken);

        // Assert
        expect(tokenBlacklistService.blacklistToken).toHaveBeenCalledWith(accessToken, userId, 'logout');
        expect(usersService.removeRefreshToken).toHaveBeenCalledWith(userId, refreshToken);
        expect(usersService.clearAllRefreshTokens).not.toHaveBeenCalled();
      });

      it('should logout user from all devices when no refresh token provided', async () => {
        // Arrange
        const userId = '507f1f77bcf86cd799439011';
        const accessToken = 'access-token';

        usersService.clearAllRefreshTokens.mockResolvedValue(undefined);
        tokenBlacklistService.blacklistToken.mockResolvedValue(undefined);
        tokenBlacklistService.blacklistAllUserTokens.mockResolvedValue(undefined);

        // Act
        await service.logout(userId, accessToken);

        // Assert
        expect(tokenBlacklistService.blacklistToken).toHaveBeenCalledWith(accessToken, userId, 'logout');
        expect(usersService.clearAllRefreshTokens).toHaveBeenCalledWith(userId);
        expect(tokenBlacklistService.blacklistAllUserTokens).toHaveBeenCalledWith(userId, 'logout');
        expect(usersService.removeRefreshToken).not.toHaveBeenCalled();
      });
    });

    describe('changePassword', () => {
      it('should change password successfully with valid current password', async () => {
        // Arrange
        const userId = '507f1f77bcf86cd799439011';
        const changePasswordDto = createMockChangePasswordDto();
        const mockUser = createMockUser();
        const mockUserWithPassword = createMockUser({
          password: '$2b$10$hashedCurrentPassword'
        });

        usersService.findById.mockResolvedValue(mockUser as UserDocument);
        usersService.findByEmailWithPassword.mockResolvedValue(mockUserWithPassword as UserDocument);
        (mockBcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValueOnce(true as never); // Current password valid
        (mockBcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValueOnce(false as never); // New password different
        usersService.updatePassword.mockResolvedValue(undefined);
        tokenBlacklistService.blacklistAllUserTokens.mockResolvedValue(undefined);

        // Act
        await service.changePassword(userId, changePasswordDto);

        // Assert
        expect(usersService.findById).toHaveBeenCalledWith(userId);
        expect(usersService.findByEmailWithPassword).toHaveBeenCalledWith(mockUser.email);
        expect(mockBcrypt.compare).toHaveBeenCalledWith(changePasswordDto.currentPassword, mockUserWithPassword.password);
        expect(mockBcrypt.compare).toHaveBeenCalledWith(changePasswordDto.newPassword, mockUserWithPassword.password);
        expect(usersService.updatePassword).toHaveBeenCalledWith(userId, changePasswordDto.newPassword);
        expect(tokenBlacklistService.blacklistAllUserTokens).toHaveBeenCalledWith(userId, 'password_change');
      });
    });

    describe('validateUser', () => {
      it('should validate user with correct credentials', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'SecurePass123!';
        const mockUser = createMockUser({
          password: '$2b$10$hashedPassword',
          toJSON: jest.fn().mockReturnValue({
            id: '507f1f77bcf86cd799439011',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: UserRole.USER,
            isActive: true,
            isEmailVerified: true,
            password: '$2b$10$hashedPassword'
          })
        });

        usersService.findByEmailWithPassword.mockResolvedValue(mockUser as UserDocument);
        (mockBcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(true as never);

        // Act
        const result = await service.validateUser(email, password);

        // Assert
        expect(result).toEqual({
          id: '507f1f77bcf86cd799439011',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.USER,
          isActive: true,
          isEmailVerified: true
        });
        expect(usersService.findByEmailWithPassword).toHaveBeenCalledWith(email);
        expect(mockBcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
      });
    });
  });

  describe('Error Handling Scenarios', () => {
    describe('register', () => {
      it('should handle ConflictException during registration', async () => {
        // Arrange
        const registerDto = createMockRegisterDto();
        const conflictError = new ConflictException('User already exists');

        usersService.create.mockRejectedValue(conflictError);

        // Act & Assert
        await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
        expect(usersService.create).toHaveBeenCalledWith(registerDto);
      });

      it('should handle generic errors during registration', async () => {
        // Arrange
        const registerDto = createMockRegisterDto();
        const genericError = new Error('Database connection failed');

        usersService.create.mockRejectedValue(genericError);

        // Act & Assert
        await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
        await expect(service.register(registerDto)).rejects.toThrow('Registration failed');
      });
    });

    describe('login', () => {
      it('should throw UnauthorizedException when user validation fails', async () => {
        // Arrange
        const loginDto = createMockLoginDto();

        jest.spyOn(service, 'validateUser').mockResolvedValue(null);

        // Act & Assert
        await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
      });
    });

    describe('refreshTokens', () => {
      it('should throw UnauthorizedException when refresh token is invalid', async () => {
        // Arrange
        const invalidRefreshToken = 'invalid-refresh-token';

        jwtService.verify.mockImplementation(() => {
          throw new Error('Invalid token');
        });

        // Act & Assert
        await expect(service.refreshTokens(invalidRefreshToken)).rejects.toThrow(UnauthorizedException);
        await expect(service.refreshTokens(invalidRefreshToken)).rejects.toThrow('Invalid refresh token');
      });

      it('should throw UnauthorizedException when user not found', async () => {
        // Arrange
        const refreshToken = 'valid-token-but-user-not-found';
        const mockPayload = {
          sub: 'non-existent-user-id',
          email: 'test@example.com',
          role: UserRole.USER
        };

        jwtService.verify.mockReturnValue(mockPayload);
        usersService.findById.mockResolvedValue(null as any);

        // Act & Assert
        await expect(service.refreshTokens(refreshToken)).rejects.toThrow(UnauthorizedException);
        await expect(service.refreshTokens(refreshToken)).rejects.toThrow('Invalid refresh token');
      });

      it('should throw UnauthorizedException when refresh token not in user tokens list', async () => {
        // Arrange
        const refreshToken = 'token-not-in-list';
        const mockUser = createMockUser({
          refreshTokens: ['different-token']
        });
        const mockPayload = {
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role
        };

        jwtService.verify.mockReturnValue(mockPayload);
        usersService.findById.mockResolvedValue(mockUser as UserDocument);
        usersService.validateRefreshToken.mockResolvedValue(false);

        // Act & Assert
        await expect(service.refreshTokens(refreshToken)).rejects.toThrow(UnauthorizedException);
        await expect(service.refreshTokens(refreshToken)).rejects.toThrow('Invalid refresh token');
      });
    });

    describe('changePassword', () => {
      it('should throw BadRequestException when user has no password set', async () => {
        // Arrange
        const userId = '507f1f77bcf86cd799439011';
        const changePasswordDto = createMockChangePasswordDto();
        const mockUser = createMockUser();
        const mockUserWithoutPassword = createMockUser({
          password: null
        });

        usersService.findById.mockResolvedValue(mockUser as UserDocument);
        usersService.findByEmailWithPassword.mockResolvedValue(mockUserWithoutPassword as UserDocument);

        // Act & Assert
        await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(BadRequestException);
        await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow('User does not have a password set.');
      });

      it('should throw BadRequestException when current password is incorrect', async () => {
        // Arrange
        const userId = '507f1f77bcf86cd799439011';
        const changePasswordDto = createMockChangePasswordDto();
        const mockUser = createMockUser();
        const mockUserWithPassword = createMockUser({
          password: '$2b$10$hashedPassword'
        });

        usersService.findById.mockResolvedValue(mockUser as UserDocument);
        usersService.findByEmailWithPassword.mockResolvedValue(mockUserWithPassword as UserDocument);
        (mockBcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(false as never); // Current password invalid

        // Act & Assert
        await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(BadRequestException);
        await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow('Current password is incorrect');
      });

      it('should throw BadRequestException when new password is same as current', async () => {
        // Arrange
        const userId = '507f1f77bcf86cd799439011';
        const changePasswordDto = createMockChangePasswordDto();
        const mockUser = createMockUser();
        const mockUserWithPassword = createMockUser({
          password: '$2b$10$hashedPassword'
        });

        usersService.findById.mockResolvedValue(mockUser as UserDocument);
        usersService.findByEmailWithPassword.mockResolvedValue(mockUserWithPassword as UserDocument);
        (mockBcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValueOnce(false as never); // Current password invalid

        // Act & Assert
        await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(BadRequestException);
        await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow('Current password is incorrect');
      });
    });

    describe('validateUser', () => {
      it('should return null when user not found', async () => {
        // Arrange
        const email = 'nonexistent@example.com';
        const password = 'password';

        usersService.findByEmailWithPassword.mockResolvedValue(null as any);

        // Act
        const result = await service.validateUser(email, password);

        // Assert
        expect(result).toBeNull();
      });

      it('should return null when user is inactive', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password';
        const inactiveUser = createMockUser({
          isActive: false
        });

        usersService.findByEmailWithPassword.mockResolvedValue(inactiveUser as UserDocument);

        // Act
        const result = await service.validateUser(email, password);

        // Assert
        expect(result).toBeNull();
      });

      it('should return null when user has no password', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password';
        const userWithoutPassword = createMockUser({
          password: null
        });

        usersService.findByEmailWithPassword.mockResolvedValue(userWithoutPassword as UserDocument);

        // Act
        const result = await service.validateUser(email, password);

        // Assert
        expect(result).toBeNull();
      });

      it('should return null when password is invalid', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'wrongpassword';
        const mockUser = createMockUser({
          password: '$2b$10$hashedPassword'
        });

        usersService.findByEmailWithPassword.mockResolvedValue(mockUser as UserDocument);
        (mockBcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValue(false as never);

        // Act
        const result = await service.validateUser(email, password);

        // Assert
        expect(result).toBeNull();
      });

      it('should handle exceptions gracefully and return null', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password';

        usersService.findByEmailWithPassword.mockRejectedValue(new Error('Database error'));

        // Act
        const result = await service.validateUser(email, password);

        // Assert
        expect(result).toBeNull();
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete token generation within reasonable time', async () => {
      // Arrange
      const mockUser = createMockUser();

      jwtService.signAsync.mockResolvedValue('mock-token');

      // Act
      const startTime = Date.now();
      const tokens = await (service as any).generateTokens(mockUser);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(tokens).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(String)
      });
    });

    it('should handle multiple concurrent registration requests', async () => {
      // Arrange
      const registerDto = createMockRegisterDto();
      const mockUser = createMockUser();

      usersService.create.mockResolvedValue(mockUser as UserDocument);
      jwtService.signAsync.mockResolvedValue('mock-token');

      // Act
      const promises = Array(10)
        .fill(null)
        .map(() => service.register({ ...registerDto, email: `test${Math.random()}@example.com` }));

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
  });

  describe('Security Validations', () => {
    it('should not include password in user response after registration', async () => {
      // Arrange
      const registerDto = createMockRegisterDto();
      const mockUser = createMockUser();

      usersService.create.mockResolvedValue(mockUser as UserDocument);
      jwtService.signAsync.mockResolvedValue('mock-token');

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        role: expect.any(String)
      });
    });

    it('should not include password in user response after login', async () => {
      // Arrange
      const loginDto = createMockLoginDto();
      const mockUserWithoutPassword = {
        id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        isActive: true,
        isEmailVerified: true
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(mockUserWithoutPassword);
      jwtService.signAsync.mockResolvedValue('mock-token');

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(result.user).not.toHaveProperty('password');
    });

    it('should generate unique refresh tokens for each request', async () => {
      // Arrange
      const mockUser = createMockUser();

      jwtService.signAsync.mockResolvedValue('mock-token');

      // Act
      await (service as any).generateTokens(mockUser);
      await (service as any).generateTokens(mockUser);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledTimes(4); // 2 calls per generateTokens (access + refresh)

      // Verify that refresh token payloads have different tokenIds
      const refreshTokenCalls = jwtService.signAsync.mock.calls.filter((_, index) => index % 2 === 1);
      const tokenId1 = (refreshTokenCalls[0][0] as any).tokenId;
      const tokenId2 = (refreshTokenCalls[1][0] as any).tokenId;

      expect(tokenId1).not.toBe(tokenId2);
    });
  });

  describe('parseExpirationTime method', () => {
    it('should parse different time units correctly', () => {
      // Act & Assert
      expect((service as any).parseExpirationTime('30s')).toBe(30 * 1000);
      expect((service as any).parseExpirationTime('15m')).toBe(15 * 60 * 1000);
      expect((service as any).parseExpirationTime('2h')).toBe(2 * 60 * 60 * 1000);
      expect((service as any).parseExpirationTime('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should return default value for invalid format', () => {
      // Act & Assert
      expect((service as any).parseExpirationTime('invalid')).toBe(15 * 60 * 1000);
      expect((service as any).parseExpirationTime('')).toBe(15 * 60 * 1000);
      expect((service as any).parseExpirationTime('100x')).toBe(15 * 60 * 1000);
    });
  });
});
