import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

import { ProfilesService } from './profiles.service';
import { ProfileRepository } from './profiles.repository';
import { Profile, ProfileDocument, ProfileType } from './schemas/profile.schema';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

describe('Profiles Integration Tests', () => {
  let service: ProfilesService;
  let repository: ProfileRepository;
  let profileModel: Model<ProfileDocument>;

  // Mock MongoDB Model
  const mockProfileModel = {
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
  };

  // Test data factories
  const createMockProfileDocument = (overrides = {}): Partial<ProfileDocument> => ({
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    type: ProfileType.PERSONAL,
    name: 'Test Profile',
    description: 'Test description',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        ProfileRepository,
        {
          provide: getModelToken(Profile.name),
          useValue: mockProfileModel
        }
      ]
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
    repository = module.get<ProfileRepository>(ProfileRepository);
    profileModel = module.get<Model<ProfileDocument>>(getModelToken(Profile.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Profile Lifecycle', () => {
    it('should create, retrieve, update, and archive a profile', async () => {
      // Test Data
      const userId = new Types.ObjectId().toString();
      const profileId = new Types.ObjectId();

      // Step 1: Create Profile
      const createDto: CreateProfileDto = {
        type: ProfileType.PERSONAL,
        name: 'My Personal Profile',
        description: 'Personal transactions and income',
        currency: 'EUR',
        timezone: 'Europe/Madrid'
      };

      const mockCreatedProfile = createMockProfileDocument({
        _id: profileId,
        userId: new Types.ObjectId(userId),
        ...createDto
      });

      // Mock creation flow
      mockProfileModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0) // No existing profiles
      });

      mockProfileModel.new = jest.fn();
      (mockProfileModel as any).mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockCreatedProfile)
      }));

      // Create profile
      const createdProfile = await service.create(userId, createDto);

      expect(createdProfile).toEqual(
        expect.objectContaining({
          type: ProfileType.PERSONAL,
          name: 'My Personal Profile',
          currency: 'EUR'
        })
      );

      // Step 2: Retrieve Profile
      mockProfileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCreatedProfile)
      });

      const retrievedProfile = await service.findOne(profileId.toString(), userId);
      expect(retrievedProfile.id).toBe(profileId.toString());
      expect(retrievedProfile.name).toBe('My Personal Profile');

      // Step 3: Update Profile
      const updateDto: UpdateProfileDto = {
        name: 'Updated Personal Profile',
        description: 'Updated description'
      };

      const mockUpdatedProfile = createMockProfileDocument({
        ...mockCreatedProfile,
        ...updateDto
      });

      mockProfileModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUpdatedProfile)
      });

      const updatedProfile = await service.update(profileId.toString(), userId, updateDto);
      expect(updatedProfile.name).toBe('Updated Personal Profile');
      expect(updatedProfile.description).toBe('Updated description');

      // Step 4: Archive Profile (should fail for only personal profile)
      mockProfileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUpdatedProfile)
      });

      // Mock findAllByUser to return only one profile
      jest.spyOn(service, 'findAllByUser').mockResolvedValue([updatedProfile]);

      await expect(service.archive(profileId.toString(), userId)).rejects.toThrow(new BadRequestException('Cannot archive the only personal profile'));
    });

    it('should handle multiple profile types and validation', async () => {
      const userId = new Types.ObjectId().toString();

      // Create Personal Profile (should succeed)
      const personalDto: CreateProfileDto = {
        type: ProfileType.PERSONAL,
        name: 'Personal Profile',
        currency: 'USD'
      };

      mockProfileModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0)
      });

      const mockPersonalProfile = createMockProfileDocument({
        type: ProfileType.PERSONAL,
        ...personalDto
      });

      (mockProfileModel as any).mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockPersonalProfile)
      }));

      const personalProfile = await service.create(userId, personalDto);
      expect(personalProfile.type).toBe(ProfileType.PERSONAL);

      // Try to create second Personal Profile (should fail)
      mockProfileModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1) // One personal profile exists
      });

      await expect(service.create(userId, personalDto)).rejects.toThrow(new ConflictException('User can only have one personal profile'));

      // Create Business Profile (should succeed)
      const businessDto: CreateProfileDto = {
        type: ProfileType.BUSINESS,
        name: 'My Business',
        currency: 'USD'
      };

      // Mock for business profile creation
      mockProfileModel.countDocuments = jest.fn().mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(0) // No business profiles yet
      });

      const mockCompanyProfile = createMockProfileDocument({
        type: ProfileType.BUSINESS,
        ...businessDto,
        settings: expect.objectContaining({
          privacy: expect.objectContaining({
            requireApproval: true,
            approvalThreshold: 500
          })
        })
      });

      (mockProfileModel as any).mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockCompanyProfile)
      }));

      const CompanyProfile = await service.create(userId, businessDto);
      expect(CompanyProfile.type).toBe(ProfileType.BUSINESS);
    });

    it('should handle active profile detection correctly', async () => {
      const userId = new Types.ObjectId().toString();
      const personalProfileId = new Types.ObjectId().toString();

      // Mock no active profile ID provided
      const mockPersonalProfile = createMockProfileDocument({
        _id: new Types.ObjectId(personalProfileId),
        type: ProfileType.PERSONAL,
        name: 'Personal Profile'
      });

      // Mock findByType for personal profiles
      mockProfileModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockPersonalProfile])
      });

      const activeProfile = await service.findActiveProfile(userId);
      expect(activeProfile).not.toBeNull();
      expect(activeProfile?.type).toBe(ProfileType.PERSONAL);

      // Test with specific active profile ID
      mockProfileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPersonalProfile)
      });

      const specificActiveProfile = await service.findActiveProfile(userId, personalProfileId);
      expect(specificActiveProfile?.id).toBe(personalProfileId);
    });

    it('should handle profile statistics correctly', async () => {
      const userId = new Types.ObjectId().toString();

      const mockProfiles = [
        createMockProfileDocument({
          type: ProfileType.PERSONAL,
          lastUsedAt: new Date('2023-12-01')
        }),
        createMockProfileDocument({
          type: ProfileType.BUSINESS,
          lastUsedAt: new Date('2023-12-02')
        }),
        createMockProfileDocument({
          type: ProfileType.BUSINESS,
          lastUsedAt: new Date('2023-11-30')
        }),
        createMockProfileDocument({
          type: ProfileType.FAMILY,
          lastUsedAt: new Date('2023-12-03')
        })
      ];

      mockProfileModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockProfiles)
      });

      const stats = await repository.getProfileStats(userId);

      expect(stats).toEqual({
        total: 4,
        byType: {
          [ProfileType.PERSONAL]: 1,
          [ProfileType.COUPLE]: 0,
          [ProfileType.FAMILY]: 1,
          [ProfileType.BUSINESS]: 2
        },
        lastUsed: new Date('2023-12-03')
      });
    });

    it('should handle profile name pattern search', async () => {
      const userId = new Types.ObjectId().toString();
      const namePattern = 'business';

      const mockCompanyProfile = createMockProfileDocument({
        name: 'My Business Profile',
        type: ProfileType.BUSINESS
      });

      mockProfileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCompanyProfile)
      });

      const foundProfile = await service.findByNamePattern(userId, namePattern);

      expect(foundProfile).not.toBeNull();
      expect(foundProfile?.name).toBe('My Business Profile');
      expect(mockProfileModel.findOne).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
        status: 'active',
        name: { $regex: new RegExp(namePattern, 'i') }
      });
    });

    it('should create personal profile with correct default settings', async () => {
      const userId = new Types.ObjectId().toString();
      const userData = {
        firstName: 'John',
        currency: 'EUR',
        timezone: 'Europe/Madrid'
      };

      mockProfileModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0)
      });

      const mockPersonalProfile = createMockProfileDocument({
        name: 'John Personal',
        currency: 'EUR',
        timezone: 'Europe/Madrid',
        type: ProfileType.PERSONAL
      });

      (mockProfileModel as any).mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockPersonalProfile)
      }));

      const personalProfile = await service.createPersonalProfile(userId, userData);

      expect(personalProfile.name).toBe('John Personal');
      expect(personalProfile.currency).toBe('EUR');
      expect(personalProfile.timezone).toBe('Europe/Madrid');
      expect(personalProfile.type).toBe(ProfileType.PERSONAL);
    });

    it('should handle error cases gracefully', async () => {
      const userId = new Types.ObjectId().toString();
      const profileId = new Types.ObjectId().toString();

      // Test profile not found
      mockProfileModel.findOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      await expect(service.findOne(profileId, userId)).rejects.toThrow(new NotFoundException('Profile not found'));

      // Test update of non-existent profile
      mockProfileModel.findOneAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      const updateDto: UpdateProfileDto = { name: 'Updated' };
      await expect(service.update(profileId, userId, updateDto)).rejects.toThrow(new NotFoundException('Profile not found'));

      // Test database error during creation
      mockProfileModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0)
      });

      (mockProfileModel as any).mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      }));

      const createDto: CreateProfileDto = {
        type: ProfileType.PERSONAL,
        name: 'Test Profile',
        currency: 'USD'
      };

      await expect(service.create(userId, createDto)).rejects.toThrow(new BadRequestException('Failed to create profile'));
    });
  });

  describe('Profile Type Limits Enforcement', () => {
    const userId = new Types.ObjectId().toString();

    it('should enforce personal profile limit (1)', async () => {
      mockProfileModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1)
      });

      const createDto: CreateProfileDto = {
        type: ProfileType.PERSONAL,
        name: 'Second Personal',
        currency: 'USD'
      };

      await expect(service.create(userId, createDto)).rejects.toThrow(new ConflictException('User can only have one personal profile'));
    });

    it('should enforce couple profile limit (1)', async () => {
      mockProfileModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(1)
      });

      const createDto: CreateProfileDto = {
        type: ProfileType.COUPLE,
        name: 'Second Couple',
        currency: 'USD'
      };

      await expect(service.create(userId, createDto)).rejects.toThrow(new ConflictException('User can only have one couple profile'));
    });

    it('should enforce family profile limit (3)', async () => {
      mockProfileModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(3)
      });

      const createDto: CreateProfileDto = {
        type: ProfileType.FAMILY,
        name: 'Fourth Family',
        currency: 'USD'
      };

      await expect(service.create(userId, createDto)).rejects.toThrow(new ConflictException('User can have maximum 3 family profiles'));
    });

    it('should enforce business profile limit (5)', async () => {
      mockProfileModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(5)
      });

      const createDto: CreateProfileDto = {
        type: ProfileType.BUSINESS,
        name: 'Sixth Business',
        currency: 'USD'
      };

      await expect(service.create(userId, createDto)).rejects.toThrow(new ConflictException('User can have maximum 5 business profiles'));
    });
  });

  describe('Profile Settings Generation', () => {
    it('should generate correct default settings for each profile type', async () => {
      const userId = new Types.ObjectId().toString();

      // Mock no existing profiles
      mockProfileModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0)
      });

      // Test Personal Profile Settings
      const personalDto: CreateProfileDto = {
        type: ProfileType.PERSONAL,
        name: 'Personal',
        currency: 'USD'
      };

      const mockPersonalProfile = createMockProfileDocument({
        type: ProfileType.PERSONAL,
        settings: {
          privacy: {
            transactionVisibility: 'private',
            reportVisibility: 'private',
            budgetVisibility: 'private',
            allowPrivateTransactions: true
          }
        }
      });

      (mockProfileModel as any).mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockPersonalProfile)
      }));

      const personalProfile = await service.create(userId, personalDto);
      expect(personalProfile.settings.privacy?.transactionVisibility).toBe('private');
      expect(personalProfile.settings.privacy?.allowPrivateTransactions).toBe(true);

      // Test Business Profile Settings
      const businessDto: CreateProfileDto = {
        type: ProfileType.BUSINESS,
        name: 'Business',
        currency: 'USD'
      };

      const mockCompanyProfile = createMockProfileDocument({
        type: ProfileType.BUSINESS,
        settings: {
          privacy: {
            requireApproval: true,
            approvalThreshold: 500
          }
        }
      });

      (mockProfileModel as any).mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockCompanyProfile)
      }));

      const CompanyProfile = await service.create(userId, businessDto);
      expect(CompanyProfile.settings.privacy?.requireApproval).toBe(true);
      expect(CompanyProfile.settings.privacy?.approvalThreshold).toBe(500);

      // Test Family Profile Settings
      const familyDto: CreateProfileDto = {
        type: ProfileType.FAMILY,
        name: 'Family',
        currency: 'USD'
      };

      const mockFamilyProfile = createMockProfileDocument({
        type: ProfileType.FAMILY,
        settings: {
          privacy: {
            childTransactionLimit: 50,
            allowPrivateTransactions: false
          }
        }
      });

      (mockProfileModel as any).mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockFamilyProfile)
      }));

      const familyProfile = await service.create(userId, familyDto);
      expect(familyProfile.settings.privacy?.childTransactionLimit).toBe(50);
      expect(familyProfile.settings.privacy?.allowPrivateTransactions).toBe(false);
    });
  });
});
