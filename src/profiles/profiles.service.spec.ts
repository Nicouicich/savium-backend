/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';

import { ProfilesService } from './profiles.service';
import { ProfileRepository } from './profiles.repository';
import { ProfileDocument, ProfileType } from './schemas/profile.schema';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';

describe('ProfilesService - Unit Tests', () => {
  let service: ProfilesService;
  let profileRepository: jest.Mocked<ProfileRepository>;

  // Test data factories
  const createMockProfileDocument = (overrides = {}): Partial<ProfileDocument> => ({
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
    ...overrides
  });

  const createMockCreateDto = (overrides = {}): CreateProfileDto => ({
    type: ProfileType.PERSONAL,
    name: 'Test Profile',
    description: 'Test description',
    currency: 'USD',
    timezone: 'America/Argentina/Buenos_Aires',
    ...overrides
  });

  const createMockUpdateDto = (overrides = {}): UpdateProfileDto => ({
    name: 'Updated Profile',
    description: 'Updated description',
    ...overrides
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: ProfileRepository,
          useValue: {
            create: jest.fn(),
            findAllByUser: jest.fn(),
            findOne: jest.fn(),
            findByType: jest.fn(),
            countByType: jest.fn(),
            update: jest.fn(),
            archive: jest.fn(),
            updateLastUsed: jest.fn(),
            findByNamePattern: jest.fn(),
            findById: jest.fn(),
            existsForUser: jest.fn(),
            findMostRecentByUser: jest.fn(),
            findWithMembers: jest.fn(),
            addMember: jest.fn(),
            removeMember: jest.fn(),
            addTransaction: jest.fn(),
            removeTransaction: jest.fn(),
            addBudget: jest.fn(),
            addGoal: jest.fn(),
            addCategory: jest.fn(),
            getProfileStats: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
    profileRepository = module.get<ProfileRepository>(ProfileRepository) as jest.Mocked<ProfileRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new profile successfully', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const createDto = createMockCreateDto();
      const mockProfile = createMockProfileDocument();

      profileRepository.countByType.mockResolvedValue(0);
      profileRepository.create.mockResolvedValue(mockProfile as ProfileDocument);

      // Act
      const result = await service.create(userId, createDto);

      // Assert
      expect(profileRepository.countByType).toHaveBeenCalledWith(userId, createDto.type);
      expect(profileRepository.create).toHaveBeenCalledWith({
        ...createDto,
        userId: new Types.ObjectId(userId),
        settings: expect.any(Object)
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: mockProfile._id?.toString(),
          type: mockProfile.type,
          name: mockProfile.name
        })
      );
    });

    it('should throw ConflictException when personal profile limit exceeded', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const createDto = createMockCreateDto({ type: ProfileType.PERSONAL });

      profileRepository.countByType.mockResolvedValue(1);

      // Act & Assert
      await expect(service.create(userId, createDto)).rejects.toThrow(new ConflictException('User can only have one personal profile'));
      expect(profileRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when couple profile limit exceeded', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const createDto = createMockCreateDto({ type: ProfileType.COUPLE });

      profileRepository.countByType.mockResolvedValue(1);

      // Act & Assert
      await expect(service.create(userId, createDto)).rejects.toThrow(new ConflictException('User can only have one couple profile'));
    });

    it('should throw ConflictException when family profile limit exceeded', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const createDto = createMockCreateDto({ type: ProfileType.FAMILY });

      profileRepository.countByType.mockResolvedValue(3);

      // Act & Assert
      await expect(service.create(userId, createDto)).rejects.toThrow(new ConflictException('User can have maximum 3 family profiles'));
    });

    it('should throw ConflictException when business profile limit exceeded', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const createDto = createMockCreateDto({ type: ProfileType.BUSINESS });

      profileRepository.countByType.mockResolvedValue(5);

      // Act & Assert
      await expect(service.create(userId, createDto)).rejects.toThrow(new ConflictException('User can have maximum 5 business profiles'));
    });

    it('should handle repository creation errors', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const createDto = createMockCreateDto();

      profileRepository.countByType.mockResolvedValue(0);
      profileRepository.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.create(userId, createDto)).rejects.toThrow(new BadRequestException('Failed to create profile'));
    });
  });

  describe('findAllByUser', () => {
    it('should return all profiles for a user', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const mockProfiles = [createMockProfileDocument({ type: ProfileType.PERSONAL }), createMockProfileDocument({ type: ProfileType.BUSINESS })];

      profileRepository.findAllByUser.mockResolvedValue(mockProfiles as ProfileDocument[]);

      // Act
      const result = await service.findAllByUser(userId);

      // Assert
      expect(profileRepository.findAllByUser).toHaveBeenCalledWith(userId);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          type: ProfileType.PERSONAL
        })
      );
    });

    it('should return empty array when no profiles found', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      profileRepository.findAllByUser.mockResolvedValue([]);

      // Act
      const result = await service.findAllByUser(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return profile when found', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockProfile = createMockProfileDocument();

      profileRepository.findOne.mockResolvedValue(mockProfile as ProfileDocument);

      // Act
      const result = await service.findOne(profileId, userId);

      // Assert
      expect(profileRepository.findOne).toHaveBeenCalledWith(profileId, userId);
      expect(result).toEqual(
        expect.objectContaining({
          id: mockProfile._id?.toString()
        })
      );
    });

    it('should throw NotFoundException when profile not found', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';

      profileRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(profileId, userId)).rejects.toThrow(new NotFoundException('Profile not found'));
    });
  });

  describe('findByType', () => {
    it('should return profiles by type', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const type = ProfileType.BUSINESS;
      const mockProfiles = [createMockProfileDocument({ type })];

      profileRepository.findByType.mockResolvedValue(mockProfiles as ProfileDocument[]);

      // Act
      const result = await service.findByType(userId, type);

      // Assert
      expect(profileRepository.findByType).toHaveBeenCalledWith(userId, type);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(type);
    });
  });

  describe('findActiveProfile', () => {
    it('should return active profile when activeProfileId provided', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const activeProfileId = '507f1f77bcf86cd799439011';
      const mockProfile = createMockProfileDocument();

      profileRepository.findOne.mockResolvedValue(mockProfile as ProfileDocument);

      // Act
      const result = await service.findActiveProfile(userId, activeProfileId);

      // Assert
      expect(profileRepository.findOne).toHaveBeenCalledWith(activeProfileId, userId);
      expect(result).toEqual(
        expect.objectContaining({
          id: mockProfile._id?.toString()
        })
      );
    });

    it('should return first personal profile when no activeProfileId provided', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const mockPersonalProfiles = [createMockProfileDocument({ type: ProfileType.PERSONAL })];

      profileRepository.findByType.mockResolvedValue(mockPersonalProfiles as ProfileDocument[]);

      // Act
      const result = await service.findActiveProfile(userId);

      // Assert
      expect(profileRepository.findByType).toHaveBeenCalledWith(userId, ProfileType.PERSONAL);
      expect(result).toEqual(
        expect.objectContaining({
          type: ProfileType.PERSONAL
        })
      );
    });

    it('should return null when no profiles found', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      profileRepository.findByType.mockResolvedValue([]);

      // Act
      const result = await service.findActiveProfile(userId);

      // Assert
      expect(result).toBeNull();
    });

    it('should fallback to personal profile when active profile not found', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const activeProfileId = '507f1f77bcf86cd799439011';
      const mockPersonalProfiles = [createMockProfileDocument({ type: ProfileType.PERSONAL })];

      profileRepository.findOne.mockRejectedValue(new Error('Not found'));
      profileRepository.findByType.mockResolvedValue(mockPersonalProfiles as ProfileDocument[]);

      // Act
      const result = await service.findActiveProfile(userId, activeProfileId);

      // Assert
      expect(profileRepository.findByType).toHaveBeenCalledWith(userId, ProfileType.PERSONAL);
      expect(result).toEqual(
        expect.objectContaining({
          type: ProfileType.PERSONAL
        })
      );
    });
  });

  describe('update', () => {
    it('should update profile successfully', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const updateDto = createMockUpdateDto();
      const mockUpdatedProfile = createMockProfileDocument({ ...updateDto });

      profileRepository.update.mockResolvedValue(mockUpdatedProfile as ProfileDocument);

      // Act
      const result = await service.update(profileId, userId, updateDto);

      // Assert
      expect(profileRepository.update).toHaveBeenCalledWith(profileId, userId, updateDto);
      expect(result).toEqual(
        expect.objectContaining({
          name: updateDto.name
        })
      );
    });

    it('should throw NotFoundException when profile not found during update', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const updateDto = createMockUpdateDto();

      profileRepository.update.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(profileId, userId, updateDto)).rejects.toThrow(new NotFoundException('Profile not found'));
    });
  });

  describe('archive', () => {
    it('should archive profile successfully', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockProfile = createMockProfileDocument({ type: ProfileType.BUSINESS });

      profileRepository.findOne.mockResolvedValue(mockProfile as ProfileDocument);
      profileRepository.archive.mockResolvedValue(true);

      // Act
      await service.archive(profileId, userId);

      // Assert
      expect(profileRepository.findOne).toHaveBeenCalledWith(profileId, userId);
      expect(profileRepository.archive).toHaveBeenCalledWith(profileId, userId);
    });

    it('should throw NotFoundException when profile not found', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';

      profileRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.archive(profileId, userId)).rejects.toThrow(new NotFoundException('Profile not found'));
      expect(profileRepository.archive).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to archive only personal profile', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockPersonalProfile = createMockProfileDocument({ type: ProfileType.PERSONAL });
      const mockUserProfiles = [mockPersonalProfile]; // Only one profile

      profileRepository.findOne.mockResolvedValue(mockPersonalProfile as ProfileDocument);
      jest.spyOn(service, 'findAllByUser').mockResolvedValue(mockUserProfiles as any);

      // Act & Assert
      await expect(service.archive(profileId, userId)).rejects.toThrow(new BadRequestException('Cannot archive the only personal profile'));
      expect(profileRepository.archive).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when archive operation fails', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockProfile = createMockProfileDocument({ type: ProfileType.BUSINESS });

      profileRepository.findOne.mockResolvedValue(mockProfile as ProfileDocument);
      profileRepository.archive.mockResolvedValue(false);

      // Act & Assert
      await expect(service.archive(profileId, userId)).rejects.toThrow(new NotFoundException('Profile not found'));
    });
  });

  describe('updateLastUsed', () => {
    it('should update last used timestamp', async () => {
      // Arrange
      const profileId = '507f1f77bcf86cd799439011';

      // Act
      await service.updateLastUsed(profileId);

      // Assert
      expect(profileRepository.updateLastUsed).toHaveBeenCalledWith(profileId);
    });
  });

  describe('findByNamePattern', () => {
    it('should find profile by name pattern', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const namePattern = 'business';
      const mockProfile = createMockProfileDocument({ name: 'My Business Profile' });

      profileRepository.findByNamePattern.mockResolvedValue(mockProfile as ProfileDocument);

      // Act
      const result = await service.findByNamePattern(userId, namePattern);

      // Assert
      expect(profileRepository.findByNamePattern).toHaveBeenCalledWith(userId, namePattern);
      expect(result).toEqual(
        expect.objectContaining({
          name: mockProfile.name
        })
      );
    });

    it('should return null when no profile matches pattern', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const namePattern = 'nonexistent';

      profileRepository.findByNamePattern.mockResolvedValue(null);

      // Act
      const result = await service.findByNamePattern(userId, namePattern);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('createPersonalProfile', () => {
    it('should create personal profile with default settings', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const userData = {
        firstName: 'John',
        currency: 'EUR',
        timezone: 'Europe/Madrid'
      };
      const mockProfile = createMockProfileDocument({
        name: 'John Personal',
        currency: 'EUR',
        timezone: 'Europe/Madrid'
      });

      profileRepository.countByType.mockResolvedValue(0);
      profileRepository.create.mockResolvedValue(mockProfile as ProfileDocument);

      // Act
      const result = await service.createPersonalProfile(userId, userData);

      // Assert
      expect(profileRepository.create).toHaveBeenCalledWith({
        type: ProfileType.PERSONAL,
        name: 'John Personal',
        currency: 'EUR',
        timezone: 'Europe/Madrid',
        description: 'Personal transactions and income',
        userId: new Types.ObjectId(userId),
        settings: expect.any(Object)
      });
      expect(result.name).toBe('John Personal');
    });

    it('should use default values when userData is minimal', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const userData = { firstName: 'Jane' };
      const mockProfile = createMockProfileDocument({
        name: 'Jane Personal',
        currency: 'USD',
        timezone: 'America/Argentina/Buenos_Aires'
      });

      profileRepository.countByType.mockResolvedValue(0);
      profileRepository.create.mockResolvedValue(mockProfile as ProfileDocument);

      // Act
      const result = await service.createPersonalProfile(userId, userData);

      // Assert
      expect(profileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'USD',
          timezone: 'America/Argentina/Buenos_Aires'
        })
      );
    });
  });

  describe('private getDefaultSettings', () => {
    it('should generate correct settings for PERSONAL profile type', () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const createDto = createMockCreateDto({ type: ProfileType.PERSONAL });
      const mockProfile = createMockProfileDocument();

      profileRepository.countByType.mockResolvedValue(0);
      profileRepository.create.mockResolvedValue(mockProfile as ProfileDocument);

      // Act
      service.create(userId, createDto);

      // Assert
      expect(profileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            privacy: expect.objectContaining({
              transactionVisibility: 'private',
              reportVisibility: 'private',
              budgetVisibility: 'private',
              allowPrivateTransactions: true
            })
          })
        })
      );
    });

    it('should generate correct settings for BUSINESS profile type', () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const createDto = createMockCreateDto({ type: ProfileType.BUSINESS });
      const mockProfile = createMockProfileDocument({ type: ProfileType.BUSINESS });

      profileRepository.countByType.mockResolvedValue(0);
      profileRepository.create.mockResolvedValue(mockProfile as ProfileDocument);

      // Act
      service.create(userId, createDto);

      // Assert
      expect(profileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            privacy: expect.objectContaining({
              requireApproval: true,
              approvalThreshold: 500
            })
          })
        })
      );
    });

    it('should generate correct settings for FAMILY profile type', () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439012';
      const createDto = createMockCreateDto({ type: ProfileType.FAMILY });
      const mockProfile = createMockProfileDocument({ type: ProfileType.FAMILY });

      profileRepository.countByType.mockResolvedValue(0);
      profileRepository.create.mockResolvedValue(mockProfile as ProfileDocument);

      // Act
      service.create(userId, createDto);

      // Assert
      expect(profileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            privacy: expect.objectContaining({
              childTransactionLimit: 50,
              allowPrivateTransactions: false
            })
          })
        })
      );
    });
  });
});
