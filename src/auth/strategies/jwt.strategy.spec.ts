/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { UserRole } from '@common/constants/user-roles';

describe('JwtStrategy - Unit Tests', () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ConfigService>;

  // Test data factories
  const createMockUser = (overrides = {}): Partial<UserDocument> => ({
    uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    _id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    role: UserRole.USER,
    isActive: true,
    isEmailVerified: true,
    accounts: [],
    preferences: {
      notifications: {
        email: true,
        push: false,
        sms: false,
        marketing: false
      },
      privacy: {
        dataCollection: true,
        analytics: true,
        thirdPartySharing: false
      },
      display: {
        currency: 'USD',
        language: 'en',
        theme: 'light' as const,
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h'
      },
      security: {
        twoFactorEnabled: false,
        sessionTimeout: 30,
        requirePasswordChange: false
      }
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  });

  const createMockJwtPayload = (overrides = {}): JwtPayload => ({
    sub: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // UUID instead of MongoDB _id
    email: 'test@example.com',
    role: UserRole.USER,
    iat: Math.floor(Date.now() / 1000),
    ...overrides
  });

  beforeEach(async () => {
    // Create mock config service with proper implementation first
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          'jwt.accessToken.secret': 'access-token-secret',
          'jwt.options.issuer': 'savium',
          'jwt.options.audience': 'savium-app'
        };
        return config[key];
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService
        },
        {
          provide: UsersService,
          useValue: {
            findByUuid: jest.fn()
          }
        }
      ]
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    configService = module.get(ConfigService);
    usersService = module.get(UsersService);

    // Reset only user service mocks, keep config service call history
    usersService.findById.mockReset();
  });

  describe('Constructor Configuration', () => {
    it('should initialize with correct configuration', () => {
      // Assert
      expect(configService.get).toHaveBeenCalledWith('jwt.accessToken.secret');
      expect(configService.get).toHaveBeenCalledWith('jwt.options.issuer');
      expect(configService.get).toHaveBeenCalledWith('jwt.options.audience');
      expect(strategy).toBeDefined();
    });
  });

  describe('Happy Path Scenarios', () => {
    describe('validate', () => {
      it('should validate and return user data for valid payload', async () => {
        // Arrange
        const payload = createMockJwtPayload();
        const mockUser = createMockUser();

        usersService.findById.mockResolvedValue(mockUser as UserDocument);

        // Act
        const result = await strategy.validate(payload);

        // Assert
        expect(result).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          isActive: mockUser.isActive,
          isEmailVerified: mockUser.isEmailVerified,
          accounts: mockUser.accounts,
          preferences: mockUser.preferences
        });
        expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
        expect(usersService.findById).toHaveBeenCalledTimes(1);
      });

      it('should handle user with MongoDB _id field', async () => {
        // Arrange
        const payload = createMockJwtPayload();
        const mockUser = createMockUser({
          id: undefined,
          _id: '507f1f77bcf86cd799439011'
        });

        usersService.findById.mockResolvedValue(mockUser as UserDocument);

        // Act
        const result = await strategy.validate(payload);

        // Assert
        expect(result).toEqual({
          id: mockUser._id,
          email: mockUser.email,
          role: mockUser.role,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          isActive: mockUser.isActive,
          isEmailVerified: mockUser.isEmailVerified,
          accounts: mockUser.accounts,
          preferences: mockUser.preferences
        });
      });

      it('should validate user with different roles', async () => {
        // Arrange
        const adminPayload = createMockJwtPayload({ role: 'ADMIN' });
        const adminUser = createMockUser({ role: 'ADMIN' });

        usersService.findById.mockResolvedValue(adminUser as UserDocument);

        // Act
        const result = await strategy.validate(adminPayload);

        // Assert
        expect(result.role).toBe('ADMIN');
        expect(result.id).toBe(adminUser.id);
        expect(result.email).toBe(adminUser.email);
      });

      it('should validate user with premium role', async () => {
        // Arrange
        const premiumPayload = createMockJwtPayload({ role: 'PREMIUM' });
        const premiumUser = createMockUser({ role: 'PREMIUM' });

        usersService.findById.mockResolvedValue(premiumUser as UserDocument);

        // Act
        const result = await strategy.validate(premiumPayload);

        // Assert
        expect(result.role).toBe('PREMIUM');
        expect(result.id).toBe(premiumUser.id);
      });

      it('should handle user with no preferences', async () => {
        // Arrange
        const payload = createMockJwtPayload();
        const mockUser = createMockUser({
          preferences: undefined
        });

        usersService.findById.mockResolvedValue(mockUser as UserDocument);

        // Act
        const result = await strategy.validate(payload);

        // Assert
        expect(result.preferences).toBeUndefined();
        expect(result.id).toBe(mockUser.id);
      });

      it('should handle user with empty accounts array', async () => {
        // Arrange
        const payload = createMockJwtPayload();
        const mockUser = createMockUser({
          accounts: []
        });

        usersService.findById.mockResolvedValue(mockUser as UserDocument);

        // Act
        const result = await strategy.validate(payload);

        // Assert
        expect(result.accounts).toEqual([]);
        expect(result.id).toBe(mockUser.id);
      });

      it('should handle user with multiple accounts', async () => {
        // Arrange
        const payload = createMockJwtPayload();
        const mockAccounts = [
          { id: 'account1', name: 'Personal' },
          { id: 'account2', name: 'Business' }
        ];
        const mockUser = createMockUser({
          accounts: mockAccounts
        });

        usersService.findById.mockResolvedValue(mockUser as UserDocument);

        // Act
        const result = await strategy.validate(payload);

        // Assert
        expect(result.accounts).toEqual(mockAccounts);
        expect(result.accounts).toHaveLength(2);
      });
    });
  });

  describe('Error Handling Scenarios', () => {
    describe('validate', () => {
      it('should throw UnauthorizedException when user not found', async () => {
        // Arrange
        const payload = createMockJwtPayload();

        usersService.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
        await expect(strategy.validate(payload)).rejects.toThrow('Invalid token');
        expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
      });

      it('should throw UnauthorizedException when user is inactive', async () => {
        // Arrange
        const payload = createMockJwtPayload();
        const inactiveUser = createMockUser({
          isActive: false
        });

        usersService.findById.mockResolvedValue(inactiveUser as UserDocument);

        // Act & Assert
        await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
        await expect(strategy.validate(payload)).rejects.toThrow('Invalid token');
        expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
      });

      it('should throw UnauthorizedException when usersService throws error', async () => {
        // Arrange
        const payload = createMockJwtPayload();
        const dbError = new Error('Database connection failed');

        usersService.findById.mockRejectedValue(dbError);

        // Act & Assert
        await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
        await expect(strategy.validate(payload)).rejects.toThrow('Invalid token');
        expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
      });

      it('should handle malformed user ID in payload', async () => {
        // Arrange
        const payloadWithInvalidId = createMockJwtPayload({
          sub: 'invalid-user-id'
        });

        usersService.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(strategy.validate(payloadWithInvalidId)).rejects.toThrow(UnauthorizedException);
        await expect(strategy.validate(payloadWithInvalidId)).rejects.toThrow('Invalid token');
        expect(usersService.findById).toHaveBeenCalledWith('invalid-user-id');
      });

      it('should handle undefined payload sub', async () => {
        // Arrange
        const payloadWithUndefinedSub = createMockJwtPayload({
          sub: undefined as any
        });

        usersService.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(strategy.validate(payloadWithUndefinedSub)).rejects.toThrow(UnauthorizedException);
        expect(usersService.findById).toHaveBeenCalledWith(undefined);
      });

      it('should handle empty string payload sub', async () => {
        // Arrange
        const payloadWithEmptySub = createMockJwtPayload({
          sub: ''
        });

        usersService.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(strategy.validate(payloadWithEmptySub)).rejects.toThrow(UnauthorizedException);
        expect(usersService.findById).toHaveBeenCalledWith('');
      });

      it('should handle timeout from users service', async () => {
        // Arrange
        const payload = createMockJwtPayload();
        const timeoutError = new Error('Request timeout');

        usersService.findById.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
        await expect(strategy.validate(payload)).rejects.toThrow('Invalid token');
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete validation within reasonable time', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const mockUser = createMockUser();

      usersService.findById.mockResolvedValue(mockUser as UserDocument);

      // Act
      const startTime = Date.now();
      const result = await strategy.validate(payload);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
    });

    it('should handle multiple concurrent validations', async () => {
      // Arrange
      const payloads = Array(10)
        .fill(null)
        .map((_, index) =>
          createMockJwtPayload({
            sub: `507f1f77bcf86cd79943901${index}`,
            email: `test${index}@example.com`
          })
        );

      const mockUsers = payloads.map((payload, index) =>
        createMockUser({
          id: payload.sub,
          email: payload.email
        })
      );

      usersService.findById.mockImplementation((id: string) => {
        const userIndex = parseInt(id.slice(-1));
        return Promise.resolve(mockUsers[userIndex] as UserDocument);
      });

      // Act
      const promises = payloads.map(payload => strategy.validate(payload));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.id).toBe(payloads[index].sub);
        expect(result.email).toBe(payloads[index].email);
      });
      expect(usersService.findById).toHaveBeenCalledTimes(10);
    });

    it('should handle rapid successive validations for same user', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const mockUser = createMockUser();

      usersService.findById.mockResolvedValue(mockUser as UserDocument);

      // Act
      const promises = Array(5)
        .fill(null)
        .map(() => strategy.validate(payload));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.id).toBe(mockUser.id);
        expect(result.email).toBe(mockUser.email);
      });
      expect(usersService.findById).toHaveBeenCalledTimes(5);
    });
  });

  describe('Security Validations', () => {
    it('should not include sensitive user data in response', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const mockUser = createMockUser({
        password: 'hashed-password',
        refreshTokens: ['token1', 'token2'],
        __v: 0,
        socialProviders: {
          google: { id: 'google-id' }
        }
      } as any);

      usersService.findById.mockResolvedValue(mockUser as UserDocument);

      // Act
      const result = await strategy.validate(payload);

      // Assert
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('refreshTokens');
      expect(result).not.toHaveProperty('__v');
      expect(result).not.toHaveProperty('socialProviders');

      // Should only include safe user data
      expect(result).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        role: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        isActive: expect.any(Boolean),
        isEmailVerified: expect.any(Boolean)
      });
    });

    it('should validate payload structure before processing', async () => {
      // Arrange
      const validPayload = createMockJwtPayload();
      const mockUser = createMockUser();

      usersService.findById.mockResolvedValue(mockUser as UserDocument);

      // Act
      const result = await strategy.validate(validPayload);

      // Assert
      expect(result).toBeDefined();
      expect(usersService.findById).toHaveBeenCalledWith(validPayload.sub);
    });

    it('should handle user with deleted flag gracefully', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const deletedUser = createMockUser({
        isActive: false,
        deletedAt: new Date()
      } as any);

      usersService.findById.mockResolvedValue(deletedUser as UserDocument);

      // Act & Assert
      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow('Invalid token');
    });

    it('should not expose internal user structure in validation result', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const mockUser = createMockUser({
        internalFlags: {
          beta: true,
          experimental: false
        },
        auditLog: [{ action: 'login', timestamp: new Date() }]
      } as any);

      usersService.findById.mockResolvedValue(mockUser as UserDocument);

      // Act
      const result = await strategy.validate(payload);

      // Assert
      expect(result).not.toHaveProperty('internalFlags');
      expect(result).not.toHaveProperty('auditLog');

      // Ensure we only get the expected fields
      const expectedKeys = ['id', 'email', 'role', 'firstName', 'lastName', 'isActive', 'isEmailVerified', 'accounts', 'preferences'];

      Object.keys(result).forEach(key => {
        expect(expectedKeys).toContain(key);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with null email', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const userWithNullEmail = createMockUser({
        email: null as any
      });

      usersService.findById.mockResolvedValue(userWithNullEmail as UserDocument);

      // Act
      const result = await strategy.validate(payload);

      // Assert
      expect(result.email).toBeNull();
      expect(result.id).toBe(userWithNullEmail.id);
    });

    it('should handle user with missing role', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const userWithoutRole = createMockUser({
        role: undefined as any
      });

      usersService.findById.mockResolvedValue(userWithoutRole as UserDocument);

      // Act
      const result = await strategy.validate(payload);

      // Assert
      expect(result.role).toBeUndefined();
      expect(result.id).toBe(userWithoutRole.id);
    });

    it('should handle user with extra unexpected fields', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const userWithExtraFields = createMockUser({
        unexpectedField: 'unexpected-value',
        anotherField: { nested: 'object' }
      } as any);

      usersService.findById.mockResolvedValue(userWithExtraFields as UserDocument);

      // Act
      const result = await strategy.validate(payload);

      // Assert
      expect(result).not.toHaveProperty('unexpectedField');
      expect(result).not.toHaveProperty('anotherField');
      expect(result.id).toBe(userWithExtraFields.id);
    });

    it('should handle very long user IDs', async () => {
      // Arrange
      const longUserId = 'a'.repeat(100);
      const payload = createMockJwtPayload({
        sub: longUserId
      });
      const mockUser = createMockUser({
        id: longUserId
      });

      usersService.findById.mockResolvedValue(mockUser as UserDocument);

      // Act
      const result = await strategy.validate(payload);

      // Assert
      expect(result.id).toBe(longUserId);
      expect(usersService.findById).toHaveBeenCalledWith(longUserId);
    });

    it('should handle payload with extra JWT fields', async () => {
      // Arrange
      const payloadWithExtraFields = {
        ...createMockJwtPayload(),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: 'savium-app',
        iss: 'savium',
        jti: 'unique-token-id'
      };
      const mockUser = createMockUser();

      usersService.findById.mockResolvedValue(mockUser as UserDocument);

      // Act
      const result = await strategy.validate(payloadWithExtraFields);

      // Assert
      expect(result.id).toBe(mockUser.id);
      expect(usersService.findById).toHaveBeenCalledWith(payloadWithExtraFields.sub);
    });
  });

  describe('Data Transformation', () => {
    it('should properly map user document fields to response object', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const mockUser = createMockUser({
        id: 'user-123',
        _id: 'mongo-object-id-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        isActive: true,
        isEmailVerified: false,
        accounts: [{ id: 'acc1', name: 'Personal' }],
        preferences: {
          theme: 'dark',
          language: 'en'
        }
      });

      usersService.findById.mockResolvedValue(mockUser as UserDocument);

      // Act
      const result = await strategy.validate(payload);

      // Assert
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.USER,
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        isEmailVerified: false,
        accounts: [{ id: 'acc1', name: 'Personal' }],
        preferences: {
          theme: 'dark',
          language: 'en'
        }
      });
    });

    it('should prefer id over _id when both are present', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const mockUser = createMockUser({
        id: 'preferred-id',
        _id: 'mongo-id'
      });

      usersService.findById.mockResolvedValue(mockUser as UserDocument);

      // Act
      const result = await strategy.validate(payload);

      // Assert
      expect(result.id).toBe('preferred-id');
    });

    it('should use _id when id is not present', async () => {
      // Arrange
      const payload = createMockJwtPayload();
      const mockUser = createMockUser({
        id: undefined,
        _id: 'mongo-id-only'
      });

      usersService.findById.mockResolvedValue(mockUser as UserDocument);

      // Act
      const result = await strategy.validate(payload);

      // Assert
      expect(result.id).toBe('mongo-id-only');
    });
  });
});
