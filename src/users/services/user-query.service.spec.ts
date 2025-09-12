/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Logger } from '@nestjs/common';

import { UserQueryService } from './user-query.service';
import { User, UserDocument } from '../schemas/user.schema';
import { UserProfile, UserProfileDocument } from '../schemas/user-profile.schema';
import { UserRole } from '@common/constants/user-roles';

describe('UserQueryService - Unit Tests', () => {
  let service: UserQueryService;
  let userModel: jest.Mocked<Model<UserDocument>>;
  let userProfileModel: jest.Mocked<Model<UserProfileDocument>>;

  // Test data factories
  const createMockUser = (overrides = {}): Partial<UserDocument> => ({
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.USER,
    status: 'active',
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    accounts: [],
    activeProfileId: new Types.ObjectId(),
    ...overrides
  });

  const createMockProfile = (overrides = {}): Partial<UserProfileDocument> => ({
    _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    id: '507f1f77bcf86cd799439012',
    userId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    name: 'Personal Profile',
    profileType: 'personal',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  });

  const createMockQuery = () => {
    const query = {
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn()
    };
    return query;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserQueryService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findById: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            countDocuments: jest.fn(),
            aggregate: jest.fn()
          }
        },
        {
          provide: getModelToken(UserProfile.name),
          useValue: {
            findById: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            countDocuments: jest.fn()
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

    service = module.get<UserQueryService>(UserQueryService);
    userModel = module.get(getModelToken(User.name));
    userProfileModel = module.get(getModelToken(UserProfile.name));

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Happy Path Scenarios', () => {
    describe('findById', () => {
      it('should find user by ID without population', async () => {
        // Arrange
        const userId = '507f1f77bcf86cd799439011';
        const mockUser = createMockUser();
        const mockQuery = createMockQuery();

        userModel.findById.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUser);

        // Act
        const result = await service.findById(userId);

        // Assert
        expect(result).toEqual(mockUser);
        expect(userModel.findById).toHaveBeenCalledWith(userId);
        expect(mockQuery.populate).not.toHaveBeenCalled();
        expect(mockQuery.exec).toHaveBeenCalledTimes(1);
      });

      it('should find user by ID with population', async () => {
        // Arrange
        const userId = '507f1f77bcf86cd799439011';
        const mockUser = createMockUser();
        const mockQuery = createMockQuery();
        const populateFields = ['activeProfile', 'profiles'];

        // Mock aggregate method for population
        userModel.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue([mockUser])
        });

        // Act
        const result = await service.findById(userId, populateFields);

        // Assert
        expect(result).toEqual(mockUser);
        expect(userModel.aggregate).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ $match: expect.any(Object) })]));
      });

      it('should return null when user not found', async () => {
        // Arrange
        const userId = 'nonexistent-user-id';
        const mockQuery = createMockQuery();

        userModel.findById.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(null);

        // Act
        const result = await service.findById(userId);

        // Assert
        expect(result).toBeNull();
        expect(userModel.findById).toHaveBeenCalledWith(userId);
      });
    });

    describe('findByEmail', () => {
      it('should find user by email', async () => {
        // Arrange
        const email = 'test@example.com';
        const mockUser = createMockUser({ email });
        const mockQuery = createMockQuery();

        userModel.findOne.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUser);

        // Act
        const result = await service.findByEmail(email);

        // Assert
        expect(result).toEqual(mockUser);
        expect(userModel.findOne).toHaveBeenCalledWith({ email: email.toLowerCase() });
        expect(mockQuery.exec).toHaveBeenCalledTimes(1);
      });

      it('should handle case-insensitive email search', async () => {
        // Arrange
        const email = 'TEST@EXAMPLE.COM';
        const mockUser = createMockUser({ email: 'test@example.com' });
        const mockQuery = createMockQuery();

        userModel.findOne.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUser);

        // Act
        const result = await service.findByEmail(email);

        // Assert
        expect(result).toEqual(mockUser);
        expect(userModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      });

      it('should return null when email not found', async () => {
        // Arrange
        const email = 'nonexistent@example.com';
        const mockQuery = createMockQuery();

        userModel.findOne.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(null);

        // Act
        const result = await service.findByEmail(email);

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('findByEmailWithPassword', () => {
      it('should find user by email including password field', async () => {
        // Arrange
        const email = 'test@example.com';
        const mockUser = createMockUser({
          email,
          password: '$2b$10$hashedPassword'
        });
        const mockQuery = createMockQuery();

        userModel.findOne.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUser);

        // Act
        const result = await service.findByEmailWithPassword(email);

        // Assert
        expect(result).toEqual(mockUser);
        expect(userModel.findOne).toHaveBeenCalledWith({ email: email.toLowerCase() });
        expect(mockQuery.select).toHaveBeenCalledWith('+password');
        expect(mockQuery.exec).toHaveBeenCalledTimes(1);
      });
    });

    describe('findByOAuthProvider', () => {
      it('should find user by OAuth provider', async () => {
        // Arrange
        const provider = 'google';
        const providerId = 'google-user-id';
        const mockUser = createMockUser({
          oauthProvider: provider,
          oauthProviderId: providerId
        });
        const mockQuery = createMockQuery();

        userModel.findOne.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUser);

        // Act
        const result = await service.findByOAuthProvider(provider, providerId);

        // Assert
        expect(result).toEqual(mockUser);
        expect(userModel.findOne).toHaveBeenCalledWith({
          oauthProvider: provider,
          oauthProviderId: providerId
        });
      });

      it('should return null when OAuth user not found', async () => {
        // Arrange
        const provider = 'github';
        const providerId = 'nonexistent-id';
        const mockQuery = createMockQuery();

        userModel.findOne.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(null);

        // Act
        const result = await service.findByOAuthProvider(provider, providerId);

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('findByIds', () => {
      it('should find users by array of IDs', async () => {
        // Arrange
        const ids = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
        const mockUsers = ids.map(id => createMockUser({ _id: new Types.ObjectId(id) }));
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUsers);

        // Act
        const result = await service.findByIds(ids);

        // Assert
        expect(result).toEqual(mockUsers);
        expect(userModel.find).toHaveBeenCalledWith({
          _id: { $in: ids.map(id => new Types.ObjectId(id)) }
        });
      });

      it('should return empty array when no users found', async () => {
        // Arrange
        const ids = [new Types.ObjectId().toString(), new Types.ObjectId().toString()];
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue([]);

        // Act
        const result = await service.findByIds(ids);

        // Assert
        expect(result).toEqual([]);
      });

      it('should handle empty IDs array', async () => {
        // Arrange
        const ids: string[] = [];
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue([]);

        // Act
        const result = await service.findByIds(ids);

        // Assert
        expect(result).toEqual([]);
        expect(userModel.find).toHaveBeenCalledWith({
          _id: { $in: [] }
        });
      });
    });

    describe('findWithPagination', () => {
      it('should find users with pagination', async () => {
        // Arrange
        const filter = { isActive: true };
        const page = 1;
        const limit = 10;
        const sort = { createdAt: -1 };
        const mockUsers = [createMockUser(), createMockUser()];
        const totalCount = 25;
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUsers);
        userModel.countDocuments.mockResolvedValue(totalCount);

        // Act
        const result = await service.findWithPagination(filter, page, limit, sort);

        // Assert
        expect(result).toEqual({
          users: mockUsers,
          total: totalCount,
          totalPages: 3 // Math.ceil(25 / 10)
        });
        expect(userModel.find).toHaveBeenCalledWith(filter);
        expect(mockQuery.sort).toHaveBeenCalledWith(sort);
        expect(mockQuery.skip).toHaveBeenCalledWith(0); // (1 - 1) * 10
        expect(mockQuery.limit).toHaveBeenCalledWith(limit);
        expect(userModel.countDocuments).toHaveBeenCalledWith(filter);
      });

      it('should use default values when parameters not provided', async () => {
        // Arrange
        const mockUsers = [createMockUser()];
        const totalCount = 5;
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUsers);
        userModel.countDocuments.mockResolvedValue(totalCount);

        // Act
        const result = await service.findWithPagination();

        // Assert
        expect(result).toEqual({
          users: mockUsers,
          total: totalCount,
          totalPages: 1
        });
        expect(userModel.find).toHaveBeenCalledWith({});
        expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(mockQuery.skip).toHaveBeenCalledWith(0);
        expect(mockQuery.limit).toHaveBeenCalledWith(10);
      });

      it('should handle second page correctly', async () => {
        // Arrange
        const page = 2;
        const limit = 5;
        const mockUsers = [createMockUser()];
        const totalCount = 12;
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUsers);
        userModel.countDocuments.mockResolvedValue(totalCount);

        // Act
        const result = await service.findWithPagination({}, page, limit);

        // Assert
        expect(result).toEqual({
          users: mockUsers,
          total: totalCount,
          totalPages: 3 // Math.ceil(12 / 5)
        });
        expect(mockQuery.skip).toHaveBeenCalledWith(5); // (2 - 1) * 5
        expect(mockQuery.limit).toHaveBeenCalledWith(5);
      });
    });

    describe('findByRole', () => {
      it('should find users by role', async () => {
        // Arrange
        const role = 'ADMIN';
        const mockUsers = [createMockUser({ role }), createMockUser({ role })];
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUsers);

        // Act
        const result = await service.findByRole(role);

        // Assert
        expect(result).toEqual(mockUsers);
        expect(userModel.find).toHaveBeenCalledWith({ role });
      });

      it('should return empty array when no users with role found', async () => {
        // Arrange
        const role = 'SUPER_ADMIN';
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue([]);

        // Act
        const result = await service.findByRole(role);

        // Assert
        expect(result).toEqual([]);
      });
    });

    describe('findByStatus', () => {
      it('should find users by status', async () => {
        // Arrange
        const status = 'pending';
        const mockUsers = [createMockUser({ status })];
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUsers);

        // Act
        const result = await service.findByStatus(status);

        // Assert
        expect(result).toEqual(mockUsers);
        expect(userModel.find).toHaveBeenCalledWith({ status });
      });
    });

    describe('findWithActiveProfiles', () => {
      it('should find users with active profiles', async () => {
        // Arrange
        const mockUsers = [createMockUser({ activeProfileId: new Types.ObjectId() })];
        const mockQuery = createMockQuery();

        // Mock aggregate method since findWithActiveProfiles uses aggregate
        userModel.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUsers)
        });

        // Act
        const result = await service.findWithActiveProfiles();

        // Assert
        expect(result).toEqual(mockUsers);
        expect(userModel.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              $match: { activeProfileId: { $exists: true, $ne: null } }
            })
          ])
        );
      });
    });

    describe('searchUsers', () => {
      it('should search users by query string', async () => {
        // Arrange
        const query = 'John';
        const limit = 5;
        const mockUsers = [createMockUser({ firstName: 'John' }), createMockUser({ lastName: 'Johnson' })];
        const mockQueryBuilder = createMockQuery();

        userModel.find.mockReturnValue(mockQueryBuilder);
        mockQueryBuilder.exec.mockResolvedValue(mockUsers);

        // Act
        const result = await service.searchUsers(query, limit);

        // Assert
        expect(result).toEqual(mockUsers);
        expect(userModel.find).toHaveBeenCalledWith({
          $or: [{ firstName: expect.any(RegExp) }, { lastName: expect.any(RegExp) }, { email: expect.any(RegExp) }],
          isActive: true
        });
        expect(mockQueryBuilder.limit).toHaveBeenCalledWith(limit);
      });

      it('should use default limit when not provided', async () => {
        // Arrange
        const query = 'test';
        const mockUsers = [createMockUser()];
        const mockQueryBuilder = createMockQuery();

        userModel.find.mockReturnValue(mockQueryBuilder);
        mockQueryBuilder.exec.mockResolvedValue(mockUsers);

        // Act
        const result = await service.searchUsers(query);

        // Assert
        expect(result).toEqual(mockUsers);
        expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      });

      it('should handle case-insensitive search', async () => {
        // Arrange
        const query = 'JOHN';
        const mockUsers = [createMockUser()];
        const mockQueryBuilder = createMockQuery();

        userModel.find.mockReturnValue(mockQueryBuilder);
        mockQueryBuilder.exec.mockResolvedValue(mockUsers);

        // Act
        await service.searchUsers(query);

        // Assert
        const searchCall = userModel.find.mock.calls[0][0];
        expect(searchCall.$or[0].firstName.flags).toBe('i'); // Case-insensitive flag
      });
    });

    describe('emailExists', () => {
      it('should return true when email exists', async () => {
        // Arrange
        const email = 'existing@example.com';
        userModel.countDocuments.mockResolvedValue(1);

        // Act
        const result = await service.emailExists(email);

        // Assert
        expect(result).toBe(true);
        expect(userModel.countDocuments).toHaveBeenCalledWith({
          email: email.toLowerCase()
        });
      });

      it('should return false when email does not exist', async () => {
        // Arrange
        const email = 'nonexistent@example.com';
        userModel.countDocuments.mockResolvedValue(0);

        // Act
        const result = await service.emailExists(email);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle case-insensitive email check', async () => {
        // Arrange
        const email = 'TEST@EXAMPLE.COM';
        userModel.countDocuments.mockResolvedValue(1);

        // Act
        const result = await service.emailExists(email);

        // Assert
        expect(result).toBe(true);
        expect(userModel.countDocuments).toHaveBeenCalledWith({
          email: 'test@example.com'
        });
      });
    });

    describe('getUserStats', () => {
      it('should return comprehensive user statistics', async () => {
        // Arrange
        const mockRoleStats = [
          { _id: 'USER', count: 100 },
          { _id: 'ADMIN', count: 5 }
        ];
        const mockStatusStats = [
          { _id: 'active', count: 90 },
          { _id: 'pending', count: 15 }
        ];

        userModel.countDocuments
          .mockResolvedValueOnce(105) // total
          .mockResolvedValueOnce(90) // active
          .mockResolvedValueOnce(85); // verified

        userModel.aggregate
          .mockResolvedValueOnce(mockRoleStats) // role stats
          .mockResolvedValueOnce(mockStatusStats); // status stats

        // Act
        const result = await service.getUserStats();

        // Assert
        expect(result).toEqual({
          total: 105,
          active: 90,
          verified: 85,
          byRole: {
            USER: 100,
            ADMIN: 5
          },
          byStatus: {
            active: 90,
            pending: 15
          }
        });

        expect(userModel.countDocuments).toHaveBeenCalledTimes(3);
        expect(userModel.countDocuments).toHaveBeenNthCalledWith(1);
        expect(userModel.countDocuments).toHaveBeenNthCalledWith(2, { isActive: true });
        expect(userModel.countDocuments).toHaveBeenNthCalledWith(3, { isEmailVerified: true });

        expect(userModel.aggregate).toHaveBeenCalledTimes(2);
        expect(userModel.aggregate).toHaveBeenNthCalledWith(1, [{ $group: { _id: '$role', count: { $sum: 1 } } }]);
        expect(userModel.aggregate).toHaveBeenNthCalledWith(2, [{ $group: { _id: '$status', count: { $sum: 1 } } }]);
      });

      it('should handle empty aggregation results', async () => {
        // Arrange
        userModel.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

        userModel.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        // Act
        const result = await service.getUserStats();

        // Assert
        expect(result).toEqual({
          total: 0,
          active: 0,
          verified: 0,
          byRole: {},
          byStatus: {}
        });
      });
    });

    describe('findByDateRange', () => {
      it('should find users created within date range', async () => {
        // Arrange
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-12-31');
        const mockUsers = [createMockUser()];
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue(mockUsers);

        // Act
        const result = await service.findByDateRange(startDate, endDate);

        // Assert
        expect(result).toEqual(mockUsers);
        expect(userModel.find).toHaveBeenCalledWith({
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        });
      });

      it('should return empty array when no users in date range', async () => {
        // Arrange
        const startDate = new Date('2025-01-01');
        const endDate = new Date('2025-12-31');
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue([]);

        // Act
        const result = await service.findByDateRange(startDate, endDate);

        // Assert
        expect(result).toEqual([]);
      });
    });

    describe('findByAccountIds', () => {
      it('should find users by account IDs', async () => {
        // Arrange
        const accountIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
        const mockUsers = [createMockUser()];
        const mockQuery = createMockQuery();

        // Mock aggregate method since findByAccountIds uses aggregate
        userModel.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUsers)
        });

        // Act
        const result = await service.findByAccountIds(accountIds);

        // Assert
        expect(result).toEqual(mockUsers);
        expect(userModel.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              $match: { accounts: { $in: expect.any(Array) } }
            })
          ])
        );
      });

      it('should handle empty account IDs array', async () => {
        // Arrange
        const accountIds: string[] = [];
        const mockQuery = createMockQuery();

        // Mock aggregate method since findByAccountIds uses aggregate
        userModel.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue([])
        });

        // Act
        const result = await service.findByAccountIds(accountIds);

        // Assert
        expect(result).toEqual([]);
        expect(userModel.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              $match: { accounts: { $in: expect.any(Array) } }
            })
          ])
        );
      });
    });
  });

  describe('Error Handling Scenarios', () => {
    describe('findById', () => {
      it('should handle database errors gracefully', async () => {
        // Arrange
        const userId = '507f1f77bcf86cd799439011';
        const dbError = new Error('Database connection failed');
        const mockQuery = createMockQuery();

        userModel.findById.mockReturnValue(mockQuery);
        mockQuery.exec.mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.findById(userId)).rejects.toThrow('Database connection failed');
      });

      it('should handle invalid ObjectId format', async () => {
        // Arrange
        const invalidId = 'invalid-id-format';
        const mockQuery = createMockQuery();

        userModel.findById.mockReturnValue(mockQuery);
        mockQuery.exec.mockRejectedValue(new Error('Cast to ObjectId failed'));

        // Act & Assert
        await expect(service.findById(invalidId)).rejects.toThrow('Cast to ObjectId failed');
      });
    });

    describe('findByEmail', () => {
      it('should handle database errors', async () => {
        // Arrange
        const email = 'test@example.com';
        const dbError = new Error('Database error');
        const mockQuery = createMockQuery();

        userModel.findOne.mockReturnValue(mockQuery);
        mockQuery.exec.mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.findByEmail(email)).rejects.toThrow('Database error');
      });
    });

    describe('findWithPagination', () => {
      it('should handle database errors in user query', async () => {
        // Arrange
        const mockQuery = createMockQuery();
        const dbError = new Error('Query failed');

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockRejectedValue(dbError);
        userModel.countDocuments.mockResolvedValue(10);

        // Act & Assert
        await expect(service.findWithPagination()).rejects.toThrow('Query failed');
      });

      it('should handle database errors in count query', async () => {
        // Arrange
        const mockQuery = createMockQuery();
        const dbError = new Error('Count failed');

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockResolvedValue([]);
        userModel.countDocuments.mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.findWithPagination()).rejects.toThrow('Count failed');
      });
    });

    describe('searchUsers', () => {
      it('should handle invalid regex patterns', async () => {
        // Arrange
        const invalidQuery = '[';
        const mockQuery = createMockQuery();

        userModel.find.mockReturnValue(mockQuery);
        mockQuery.exec.mockRejectedValue(new Error('Invalid regular expression'));

        // Act & Assert
        await expect(service.searchUsers(invalidQuery)).rejects.toThrow('Invalid regular expression');
      });
    });

    describe('getUserStats', () => {
      it('should handle aggregation errors', async () => {
        // Arrange
        const aggregationError = new Error('Aggregation failed');

        userModel.countDocuments.mockResolvedValue(100);
        userModel.aggregate.mockRejectedValue(aggregationError);

        // Act & Assert
        await expect(service.getUserStats()).rejects.toThrow('Aggregation failed');
      });
    });

    describe('findByIds', () => {
      it('should handle invalid ObjectId in array', async () => {
        // Arrange
        const ids = ['507f1f77bcf86cd799439011', 'invalid-id'];

        // Act & Assert - the error is thrown during ObjectId construction
        await expect(service.findByIds(ids)).rejects.toThrow('input must be a 24 character hex string');
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete simple queries within reasonable time', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const mockUser = createMockUser();
      const mockQuery = createMockQuery();

      userModel.findById.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue(mockUser);

      // Act
      const startTime = Date.now();
      const result = await service.findById(userId);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100);
      expect(result).toEqual(mockUser);
    });

    it('should handle multiple concurrent queries', async () => {
      // Arrange
      const userIds = Array(10)
        .fill(null)
        .map((_, i) => `507f1f77bcf86cd79943901${i}`);
      const mockUser = createMockUser();
      const mockQuery = createMockQuery();

      userModel.findById.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue(mockUser);

      // Act
      const promises = userIds.map(id => service.findById(id));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toEqual(mockUser);
      });
      expect(userModel.findById).toHaveBeenCalledTimes(10);
    });

    it('should efficiently handle pagination queries', async () => {
      // Arrange
      const mockUsers = Array(100)
        .fill(null)
        .map(() => createMockUser());
      const mockQuery = createMockQuery();

      userModel.find.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue(mockUsers);
      userModel.countDocuments.mockResolvedValue(1000);

      // Act
      const startTime = Date.now();
      const result = await service.findWithPagination({}, 1, 100);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(200);
      expect(result.users).toHaveLength(100);
      expect(result.total).toBe(1000);
    });
  });

  describe('Security Validations', () => {
    it('should sanitize email input for case sensitivity', async () => {
      // Arrange
      const email = 'TEST@EXAMPLE.COM';
      const mockQuery = createMockQuery();

      userModel.findOne.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue(null);

      // Act
      await service.findByEmail(email);

      // Assert
      expect(userModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should handle potential injection in search queries', async () => {
      // Arrange
      const maliciousQuery = '$ne';
      const mockQuery = createMockQuery();

      userModel.find.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue([]);

      // Act
      await service.searchUsers(maliciousQuery);

      // Assert
      // The service should create a proper RegExp, not execute the malicious string
      expect(userModel.find).toHaveBeenCalledWith({
        $or: [{ firstName: expect.any(RegExp) }, { lastName: expect.any(RegExp) }, { email: expect.any(RegExp) }],
        isActive: true
      });
    });

    it('should validate ObjectId format in findByIds', async () => {
      // Arrange
      const validId1 = new Types.ObjectId().toString();
      const validId2 = new Types.ObjectId().toString();
      const ids = [validId1, validId2];
      const mockQuery = createMockQuery();

      userModel.find.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue([]);

      // Act
      await service.findByIds(ids);

      // Assert
      expect(userModel.find).toHaveBeenCalledWith({
        _id: { $in: expect.arrayContaining([expect.any(Types.ObjectId)]) }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null populate array', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const mockUser = createMockUser();
      const mockQuery = createMockQuery();

      userModel.findById.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById(userId, null as any);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockQuery.populate).not.toHaveBeenCalled();
    });

    it('should handle empty search query', async () => {
      // Arrange
      const emptyQuery = '';
      const mockQuery = createMockQuery();

      userModel.find.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue([]);

      // Act
      const result = await service.searchUsers(emptyQuery);

      // Assert
      expect(result).toEqual([]);
      expect(userModel.find).toHaveBeenCalledWith({
        $or: [{ firstName: expect.any(RegExp) }, { lastName: expect.any(RegExp) }, { email: expect.any(RegExp) }],
        isActive: true
      });
    });

    it('should handle zero page number in pagination', async () => {
      // Arrange
      const mockUsers = [createMockUser()];
      const mockQuery = createMockQuery();

      userModel.find.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue(mockUsers);
      userModel.countDocuments.mockResolvedValue(10);

      // Act
      const result = await service.findWithPagination({}, 0, 10);

      // Assert
      expect(result.users).toEqual(mockUsers);
      expect(mockQuery.skip).toHaveBeenCalledWith(-10); // (0 - 1) * 10
    });

    it('should handle very large limit in pagination', async () => {
      // Arrange
      const largeLimit = 10000;
      const mockUsers = [createMockUser()];
      const mockQuery = createMockQuery();

      userModel.find.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue(mockUsers);
      userModel.countDocuments.mockResolvedValue(5);

      // Act
      const result = await service.findWithPagination({}, 1, largeLimit);

      // Assert
      expect(result.users).toEqual(mockUsers);
      expect(result.totalPages).toBe(1); // Math.ceil(5 / 10000)
      expect(mockQuery.limit).toHaveBeenCalledWith(largeLimit);
    });
  });
});
