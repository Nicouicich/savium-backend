/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { ProfileType } from './schemas/profile.schema';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UserForJWT } from '../users/types';
import { UserRole } from '@common/constants/user-roles';

describe('ProfilesController - Unit Tests', () => {
  let controller: ProfilesController;
  let profilesService: jest.Mocked<ProfilesService>;

  // Test data factories
  const createMockUser = (overrides = {}): UserForJWT => ({
    id: '507f1f77bcf86cd799439012',
    email: 'test@example.com',
    role: UserRole.USER,
    isActive: true,
    fullName: 'John Doe',
    ...overrides
  });

  const createMockProfileResponse = (overrides = {}): ProfileResponseDto => ({
    id: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439012',
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
    status: 'active',
    totalMembers: 1,
    isPersonal: true,
    isShared: false,
    lastUsedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
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
      controllers: [ProfilesController],
      providers: [
        {
          provide: ProfilesService,
          useValue: {
            create: jest.fn(),
            findAllByUser: jest.fn(),
            findOne: jest.fn(),
            findByType: jest.fn(),
            findActiveProfile: jest.fn(),
            update: jest.fn(),
            archive: jest.fn(),
            updateLastUsed: jest.fn(),
            createPersonalProfile: jest.fn(),
            findByNamePattern: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<ProfilesController>(ProfilesController);
    profilesService = module.get<ProfilesService>(ProfilesService) as jest.Mocked<ProfilesService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new profile successfully', async () => {
      // Arrange
      const user = createMockUser();
      const createDto = createMockCreateDto();
      const mockProfile = createMockProfileResponse();

      profilesService.create.mockResolvedValue(mockProfile);

      // Act
      const result = await controller.create(createDto, user.id);

      // Assert
      expect(profilesService.create).toHaveBeenCalledWith(user.id, createDto);
      expect(result).toEqual(mockProfile);
    });

    it('should handle creation errors', async () => {
      // Arrange
      const user = createMockUser();
      const createDto = createMockCreateDto();

      profilesService.create.mockRejectedValue(new BadRequestException('Invalid profile data'));

      // Act & Assert
      await expect(controller.create(createDto, user.id)).rejects.toThrow(new BadRequestException('Invalid profile data'));
    });
  });

  describe('findAll', () => {
    it('should return all profiles for user', async () => {
      // Arrange
      const user = createMockUser();
      const mockProfiles = [createMockProfileResponse({ type: ProfileType.PERSONAL }), createMockProfileResponse({ type: ProfileType.BUSINESS })];

      profilesService.findAllByUser.mockResolvedValue(mockProfiles);

      // Act
      const result = await controller.findAll(undefined, user.id);

      // Assert
      expect(profilesService.findAllByUser).toHaveBeenCalledWith(user.id);
      expect(result).toEqual(mockProfiles);
      expect(result).toHaveLength(2);
    });

    it('should return profiles filtered by type', async () => {
      // Arrange
      const user = createMockUser();
      const type = ProfileType.BUSINESS;
      const mockProfiles = [createMockProfileResponse({ type })];

      profilesService.findByType.mockResolvedValue(mockProfiles);

      // Act
      const result = await controller.findAll(type, user.id);

      // Assert
      expect(profilesService.findByType).toHaveBeenCalledWith(user.id, type);
      expect(result).toEqual(mockProfiles);
      expect(result[0].type).toBe(type);
    });

    it('should return empty array when no profiles found', async () => {
      // Arrange
      const user = createMockUser();
      profilesService.findAllByUser.mockResolvedValue([]);

      // Act
      const result = await controller.findAll(undefined, user.id);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getActiveProfile', () => {
    it('should return active profile for user', async () => {
      // Arrange
      const user = createMockUser();
      const mockProfile = createMockProfileResponse();

      profilesService.findActiveProfile.mockResolvedValue(mockProfile);

      // Act
      const result = await controller.getActiveProfile(user);

      // Assert
      expect(profilesService.findActiveProfile).toHaveBeenCalledWith(user.id, undefined);
      expect(result).toEqual(mockProfile);
    });

    it('should return null when no active profile found', async () => {
      // Arrange
      const user = createMockUser();
      profilesService.findActiveProfile.mockResolvedValue(null);

      // Act
      const result = await controller.getActiveProfile(user);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return specific profile by ID', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';
      const mockProfile = createMockProfileResponse();

      profilesService.findOne.mockResolvedValue(mockProfile);

      // Act
      const result = await controller.findOne(profileId, user.id);

      // Assert
      expect(profilesService.findOne).toHaveBeenCalledWith(profileId, user.id);
      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException when profile not found', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';

      profilesService.findOne.mockRejectedValue(new NotFoundException('Profile not found'));

      // Act & Assert
      await expect(controller.findOne(profileId, user.id)).rejects.toThrow(new NotFoundException('Profile not found'));
    });
  });

  describe('update', () => {
    it('should update profile successfully', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';
      const updateDto = createMockUpdateDto();
      const mockUpdatedProfile = createMockProfileResponse({ ...updateDto });

      profilesService.update.mockResolvedValue(mockUpdatedProfile);

      // Act
      const result = await controller.update(profileId, updateDto, user.id);

      // Assert
      expect(profilesService.update).toHaveBeenCalledWith(profileId, user.id, updateDto);
      expect(result).toEqual(mockUpdatedProfile);
      expect(result.name).toBe(updateDto.name);
    });

    it('should throw NotFoundException when profile not found during update', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';
      const updateDto = createMockUpdateDto();

      profilesService.update.mockRejectedValue(new NotFoundException('Profile not found'));

      // Act & Assert
      await expect(controller.update(profileId, updateDto, user.id)).rejects.toThrow(new NotFoundException('Profile not found'));
    });

    it('should handle validation errors', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';
      const updateDto = createMockUpdateDto();

      profilesService.update.mockRejectedValue(new BadRequestException('Invalid update data'));

      // Act & Assert
      await expect(controller.update(profileId, updateDto, user.id)).rejects.toThrow(new BadRequestException('Invalid update data'));
    });
  });

  describe('archive', () => {
    it('should archive profile successfully', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';

      profilesService.archive.mockResolvedValue(undefined);

      // Act
      await controller.archive(profileId, user.id);

      // Assert
      expect(profilesService.archive).toHaveBeenCalledWith(profileId, user.id);
    });

    it('should throw NotFoundException when profile not found during archive', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';

      profilesService.archive.mockRejectedValue(new NotFoundException('Profile not found'));

      // Act & Assert
      await expect(controller.archive(profileId, user.id)).rejects.toThrow(new NotFoundException('Profile not found'));
    });

    it('should throw BadRequestException when trying to archive only personal profile', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';

      profilesService.archive.mockRejectedValue(new BadRequestException('Cannot archive the only personal profile'));

      // Act & Assert
      await expect(controller.archive(profileId, user.id)).rejects.toThrow(new BadRequestException('Cannot archive the only personal profile'));
    });
  });

  describe('markAsUsed', () => {
    it('should mark profile as used successfully', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';
      const mockProfile = createMockProfileResponse();

      profilesService.findOne.mockResolvedValue(mockProfile);
      profilesService.updateLastUsed.mockResolvedValue(undefined);

      // Act
      const result = await controller.markAsUsed(profileId, user.id);

      // Assert
      expect(profilesService.findOne).toHaveBeenCalledWith(profileId, user.id);
      expect(profilesService.updateLastUsed).toHaveBeenCalledWith(profileId);
      expect(result).toEqual({ message: 'Profile marked as used successfully' });
    });

    it('should throw NotFoundException when profile not found', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';

      profilesService.findOne.mockRejectedValue(new NotFoundException('Profile not found'));

      // Act & Assert
      await expect(controller.markAsUsed(profileId, user.id)).rejects.toThrow(new NotFoundException('Profile not found'));
      expect(profilesService.updateLastUsed).not.toHaveBeenCalled();
    });

    it('should verify profile ownership before updating', async () => {
      // Arrange
      const user = createMockUser();
      const profileId = '507f1f77bcf86cd799439011';
      const mockProfile = createMockProfileResponse();

      profilesService.findOne.mockResolvedValue(mockProfile);
      profilesService.updateLastUsed.mockResolvedValue(undefined);

      // Act
      await controller.markAsUsed(profileId, user.id);

      // Assert
      expect(profilesService.findOne).toHaveBeenCalledWith(profileId, user.id);
      expect(profilesService.updateLastUsed).toHaveBeenCalledWith(profileId);
    });
  });

  describe('getProfileStats', () => {
    it('should return profile statistics for user', async () => {
      // Arrange
      const user = createMockUser();
      const mockProfiles = [
        createMockProfileResponse({
          type: ProfileType.PERSONAL,
          lastUsedAt: new Date('2023-12-01')
        }),
        createMockProfileResponse({
          type: ProfileType.BUSINESS,
          lastUsedAt: new Date('2023-12-02')
        }),
        createMockProfileResponse({
          type: ProfileType.BUSINESS,
          lastUsedAt: new Date('2023-11-30')
        })
      ];

      profilesService.findAllByUser.mockResolvedValue(mockProfiles);

      // Act
      const result = await controller.getProfileStats(user.id);

      // Assert
      expect(profilesService.findAllByUser).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        total: 3,
        byType: {
          [ProfileType.PERSONAL]: 1,
          [ProfileType.BUSINESS]: 2
        },
        lastUsed: new Date('2023-12-02')
      });
    });

    it('should handle empty profile list', async () => {
      // Arrange
      const user = createMockUser();
      profilesService.findAllByUser.mockResolvedValue([]);

      // Act
      const result = await controller.getProfileStats(user.id);

      // Assert
      expect(result).toEqual({
        total: 0,
        byType: {},
        lastUsed: null
      });
    });

    it('should correctly count profiles by type', async () => {
      // Arrange
      const user = createMockUser();
      const mockProfiles = [
        createMockProfileResponse({ type: ProfileType.PERSONAL }),
        createMockProfileResponse({ type: ProfileType.COUPLE }),
        createMockProfileResponse({ type: ProfileType.FAMILY }),
        createMockProfileResponse({ type: ProfileType.FAMILY }),
        createMockProfileResponse({ type: ProfileType.BUSINESS }),
        createMockProfileResponse({ type: ProfileType.BUSINESS }),
        createMockProfileResponse({ type: ProfileType.BUSINESS })
      ];

      profilesService.findAllByUser.mockResolvedValue(mockProfiles);

      // Act
      const result = await controller.getProfileStats(user.id);

      // Assert
      expect(result.byType).toEqual({
        [ProfileType.PERSONAL]: 1,
        [ProfileType.COUPLE]: 1,
        [ProfileType.FAMILY]: 2,
        [ProfileType.BUSINESS]: 3
      });
    });

    it('should find the most recent lastUsed date', async () => {
      // Arrange
      const user = createMockUser();
      const dates = [
        new Date('2023-11-15'),
        new Date('2023-12-10'), // Most recent
        new Date('2023-11-28'),
        new Date('2023-12-01')
      ];

      const mockProfiles = dates.map((date, index) =>
        createMockProfileResponse({
          type: ProfileType.BUSINESS,
          lastUsedAt: date
        })
      );

      profilesService.findAllByUser.mockResolvedValue(mockProfiles);

      // Act
      const result = await controller.getProfileStats(user.id);

      // Assert
      expect(result.lastUsed).toEqual(new Date('2023-12-10'));
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      // Arrange
      const user = createMockUser();
      profilesService.findAllByUser.mockRejectedValue(new Error('Database connection error'));

      // Act & Assert
      await expect(controller.findAll(undefined, user.id)).rejects.toThrow('Database connection error');
    });

    it('should pass through service exceptions', async () => {
      // Arrange
      const user = createMockUser();
      const createDto = createMockCreateDto();

      profilesService.create.mockRejectedValue(new BadRequestException('Validation failed'));

      // Act & Assert
      await expect(controller.create(createDto, user.id)).rejects.toThrow(new BadRequestException('Validation failed'));
    });
  });
});
