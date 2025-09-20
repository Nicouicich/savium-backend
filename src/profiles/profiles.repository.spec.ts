/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ProfileRepository } from './profiles.repository';
import { Profile, ProfileDocument, ProfileType } from './schemas/profile.schema';

describe('ProfileRepository - Unit Tests', () => {
  let repository: ProfileRepository;
  let profileModel: jest.Mocked<Model<ProfileDocument>>;

  // Test data factories
  const createMockProfile = (overrides = {}): Partial<ProfileDocument> => ({
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    userId: new Types.ObjectId('507f1f77bcf86cd799439012'),
    type: ProfileType.PERSONAL,
    name: 'Personal Profile',
    description: 'Test personal profile',
    currency: 'USD',
    timezone: 'America/Argentina/Buenos_Aires',
    settings: {
      privacy: {
        transactionVisibility: 'private',
        reportVisibility: 'private',
        budgetVisibility: 'private',
        allowPrivateTransactions: true
      },
      notifications: {
        enabled: true,
        frequency: 'daily',
        channels: ['email']
      },
      preferences: {
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        weekStartDay: 'monday',
        autoCategorizationEnabled: true,
        receiptScanningEnabled: true
      }
    },
    members: [],
    transactions: [],
    budgets: [],
    goals: [],
    categories: [],
    status: 'active',
    lastUsedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    totalMembers: 1,
    isPersonal: true,
    isShared: false,
    save: jest.fn().mockResolvedValue(this),
    ...overrides
  });

  const createMockQuery = (data: any) => ({
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findOneAndUpdate: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(data)
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileRepository,
        {
          provide: getModelToken(Profile.name),
          useValue: {
            new: jest.fn(),
            constructor: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            countDocuments: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            exec: jest.fn()
          }
        }
      ]
    }).compile();

    repository = module.get<ProfileRepository>(ProfileRepository);
    profileModel = module.get<Model<ProfileDocument>>(getModelToken(Profile.name)) as jest.Mocked<Model<ProfileDocument>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new profile successfully', async () => {
      // Arrange
      const profileData = {
        userId: new Types.ObjectId('507f1f77bcf86cd799439012'),
        type: ProfileType.PERSONAL,
        name: 'Test Profile',
        currency: 'USD'
      };

      const mockProfile = createMockProfile(profileData);
      const mockSave = jest.fn().mockResolvedValue(mockProfile);

      // Mock the constructor to return an object with save method
      (profileModel as any).mockImplementation(() => ({
        save: mockSave
      }));

      // Act
      const result = await repository.create(profileData);

      // Assert
      expect(profileModel).toHaveBeenCalledWith(profileData);
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockProfile);
    });

    it('should handle creation errors gracefully', async () => {
      // Arrange
      const profileData = {
        userId: new Types.ObjectId('507f1f77bcf86cd799439012'),
        type: ProfileType.PERSONAL,
        name: 'Test Profile'
      };

      const mockSave = jest.fn().mockRejectedValue(new Error('Database error'));
      (profileModel as any).mockImplementation(() => ({
        save: mockSave
      }));

      // Act & Assert
      await expect(repository.create(profileData)).rejects.toThrow('Database error');
    });
  });

  describe('findAllByUser', () => {
    it('should find all active profiles for a user', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const mockProfiles = [createMockProfile({ type: ProfileType.PERSONAL }), createMockProfile({ type: ProfileType.BUSINESS })];

      const mockQuery = createMockQuery(mockProfiles);
      profileModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.findAllByUser(userId);

      // Assert
      expect(profileModel.find).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
        status: 'active'
      });
      expect(mockQuery.sort).toHaveBeenCalledWith({ lastUsedAt: -1 });
      expect(result).toEqual(mockProfiles);
    });

    it('should return empty array if no profiles found', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const mockQuery = createMockQuery([]);
      profileModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.findAllByUser(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should find profile by ID and user ID', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockProfile = createMockProfile();

      const mockQuery = createMockQuery(mockProfile);
      profileModel.findOne = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.findOne(profileId, userId);

      // Assert
      expect(profileModel.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        status: 'active'
      });
      expect(result).toEqual(mockProfile);
    });

    it('should return null if profile not found', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';

      const mockQuery = createMockQuery(null);
      profileModel.findOne = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.findOne(profileId, userId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByType', () => {
    it('should find profiles by type for a user', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const type = ProfileType.BUSINESS;
      const mockProfiles = [createMockProfile({ type: ProfileType.BUSINESS }), createMockProfile({ type: ProfileType.BUSINESS })];

      const mockQuery = createMockQuery(mockProfiles);
      profileModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.findByType(userId, type);

      // Assert
      expect(profileModel.find).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
        type,
        status: 'active'
      });
      expect(result).toEqual(mockProfiles);
    });
  });

  describe('countByType', () => {
    it('should count profiles by type for a user', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const type = ProfileType.FAMILY;
      const expectedCount = 2;

      const mockQuery = createMockQuery(expectedCount);
      profileModel.countDocuments = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.countByType(userId, type);

      // Assert
      expect(profileModel.countDocuments).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
        type,
        status: 'active'
      });
      expect(result).toBe(expectedCount);
    });
  });

  describe('update', () => {
    it('should update profile successfully', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const updateData = { name: 'Updated Profile' };
      const mockUpdatedProfile = createMockProfile({ ...updateData });

      const mockQuery = createMockQuery(mockUpdatedProfile);
      profileModel.findOneAndUpdate = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.update(profileId, userId, updateData);

      // Assert
      expect(profileModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: new Types.ObjectId(profileId),
          userId: new Types.ObjectId(userId),
          status: 'active'
        },
        {
          ...updateData,
          lastUsedAt: expect.any(Date)
        },
        {
          new: true,
          runValidators: true
        }
      );
      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should return null if profile not found during update', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const updateData = { name: 'Updated Profile' };

      const mockQuery = createMockQuery(null);
      profileModel.findOneAndUpdate = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.update(profileId, userId, updateData);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('archive', () => {
    it('should archive profile successfully', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockArchivedProfile = createMockProfile({ status: 'archived' });

      const mockQuery = createMockQuery(mockArchivedProfile);
      profileModel.findOneAndUpdate = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.archive(profileId, userId);

      // Assert
      expect(profileModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: new Types.ObjectId(profileId),
          userId: new Types.ObjectId(userId)
        },
        { status: 'archived' },
        { new: true }
      );
      expect(result).toBe(true);
    });

    it('should return false if profile not found during archive', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';

      const mockQuery = createMockQuery(null);
      profileModel.findOneAndUpdate = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.archive(profileId, userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsedAt timestamp', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';

      const mockQuery = createMockQuery({});
      profileModel.findByIdAndUpdate = jest.fn().mockReturnValue(mockQuery);

      // Act
      await repository.updateLastUsed(profileId);

      // Assert
      expect(profileModel.findByIdAndUpdate).toHaveBeenCalledWith(new Types.ObjectId(profileId), { lastUsedAt: expect.any(Date) });
    });
  });

  describe('findByNamePattern', () => {
    it('should find profile by name pattern', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const namePattern = 'business';
      const mockProfile = createMockProfile({ name: 'My Business Profile' });

      const mockQuery = createMockQuery(mockProfile);
      profileModel.findOne = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.findByNamePattern(userId, namePattern);

      // Assert
      expect(profileModel.findOne).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
        status: 'active',
        name: { $regex: new RegExp(namePattern, 'i') }
      });
      expect(result).toEqual(mockProfile);
    });
  });

  describe('existsForUser', () => {
    it('should return true if profile exists for user', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';

      const mockQuery = createMockQuery(1);
      profileModel.countDocuments = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.existsForUser(profileId, userId);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if profile does not exist for user', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';

      const mockQuery = createMockQuery(0);
      profileModel.countDocuments = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.existsForUser(profileId, userId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('addMember', () => {
    it('should add member to profile', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const memberUserId = '507f1f77bcf86cd799439013';
      const mockProfile = createMockProfile({
        members: [new Types.ObjectId(memberUserId)]
      });

      const mockQuery = createMockQuery(mockProfile);
      profileModel.findOneAndUpdate = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await repository.addMember(profileId, userId, memberUserId);

      // Assert
      expect(profileModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: new Types.ObjectId(profileId),
          userId: new Types.ObjectId(userId),
          status: 'active'
        },
        {
          $addToSet: { members: new Types.ObjectId(memberUserId) },
          lastUsedAt: expect.any(Date)
        },
        {
          new: true,
          runValidators: true
        }
      );
      expect(result).toEqual(mockProfile);
    });
  });

  describe('getProfileStats', () => {
    it('should return profile statistics', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const mockProfiles = [
        createMockProfile({
          type: ProfileType.PERSONAL,
          lastUsedAt: new Date('2023-12-01')
        }),
        createMockProfile({
          type: ProfileType.BUSINESS,
          lastUsedAt: new Date('2023-12-02')
        }),
        createMockProfile({
          type: ProfileType.BUSINESS,
          lastUsedAt: new Date('2023-11-30')
        })
      ];

      jest.spyOn(repository, 'findAllByUser').mockResolvedValue(mockProfiles as any);

      // Act
      const result = await repository.getProfileStats(userId);

      // Assert
      expect(result).toEqual({
        total: 3,
        byType: {
          [ProfileType.PERSONAL]: 1,
          [ProfileType.COUPLE]: 0,
          [ProfileType.FAMILY]: 0,
          [ProfileType.BUSINESS]: 2
        },
        lastUsed: new Date('2023-12-02')
      });
    });

    it('should handle empty profile list', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      jest.spyOn(repository, 'findAllByUser').mockResolvedValue([]);

      // Act
      const result = await repository.getProfileStats(userId);

      // Assert
      expect(result).toEqual({
        total: 0,
        byType: {
          [ProfileType.PERSONAL]: 0,
          [ProfileType.COUPLE]: 0,
          [ProfileType.FAMILY]: 0,
          [ProfileType.BUSINESS]: 0
        },
        lastUsed: null
      });
    });
  });
});
