import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileRepository } from './profiles.repository';
import { ProfileDocument } from './schemas/profile.schema';
import { ProfileType } from 'src/financial-profiles/schemas';

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly usersService: UsersService
  ) {}

  /**
   * Create a new profile for a user
   */
  async create(userId: string, createProfileDto: CreateProfileDto): Promise<ProfileResponseDto> {
    this.logger.log('Creating new profile', { userId, type: createProfileDto.type });

    // Validate user can create this type of profile
    await this.validateProfileCreation(userId, createProfileDto.type);

    // Set default settings based on profile type
    const profileData = {
      ...createProfileDto,
      userId: new Types.ObjectId(userId),
      settings: this.getDefaultSettings(createProfileDto.type, createProfileDto.settings)
    };

    try {
      const savedProfile = await this.profileRepository.create(profileData);

      // Add profile to user's profiles array
      await this.usersService.addProfile(userId, savedProfile._id.toString());

      // Set as active profile if it's the user's first profile
      const userProfiles = await this.findAllByUser(userId);
      if (userProfiles.length === 1) {
        await this.usersService.setActiveProfile(userId, savedProfile._id.toString());
      }

      this.logger.log('Profile created successfully', {
        userId,
        profileId: savedProfile._id,
        type: savedProfile.type
      });

      return this.mapToResponseDto(savedProfile);
    } catch (error) {
      this.logger.error('Failed to create profile', { userId, error: error.message });
      throw new BadRequestException('Failed to create profile');
    }
  }

  /**
   * Get all profiles for a user
   */
  async findAllByUser(userId: string): Promise<ProfileResponseDto[]> {
    const profiles = await this.profileRepository.findAllByUser(userId);
    return profiles.map(profile => this.mapToResponseDto(profile));
  }

  /**
   * Get a specific profile by ID
   */
  async findOne(profileId: string, userId: string): Promise<ProfileResponseDto> {
    const profile = await this.profileRepository.findOne(profileId, userId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.mapToResponseDto(profile);
  }

  /**
   * Get profiles by type for a user
   */
  async findByType(userId: string, type: ProfileType): Promise<ProfileResponseDto[]> {
    const profiles = await this.profileRepository.findByType(userId, type);
    return profiles.map(profile => this.mapToResponseDto(profile));
  }

  /**
   * Get user's active profile
   */
  async findActiveProfile(userId: string, activeProfileId?: string): Promise<ProfileResponseDto | null> {
    if (!activeProfileId) {
      // Return first personal profile if no active profile set
      const personalProfiles = await this.findByType(userId, ProfileType.PERSONAL);
      return personalProfiles[0] || null;
    }

    try {
      return await this.findOne(activeProfileId, userId);
    } catch {
      // If active profile not found, fallback to personal
      const personalProfiles = await this.findByType(userId, ProfileType.PERSONAL);
      return personalProfiles[0] || null;
    }
  }

  /**
   * Update a profile
   */
  async update(profileId: string, userId: string, updateProfileDto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const updatedProfile = await this.profileRepository.update(profileId, userId, updateProfileDto);

    if (!updatedProfile) {
      throw new NotFoundException('Profile not found');
    }

    this.logger.log('Profile updated successfully', {
      userId,
      profileId,
      changes: Object.keys(updateProfileDto)
    });

    return this.mapToResponseDto(updatedProfile);
  }

  /**
   * Archive a profile (soft delete)
   */
  async archive(profileId: string, userId: string): Promise<void> {
    const profile = await this.profileRepository.findOne(profileId, userId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Can't archive personal profile if it's the only one
    if (profile.type === ProfileType.PERSONAL) {
      const userProfiles = await this.findAllByUser(userId);
      if (userProfiles.length === 1) {
        throw new BadRequestException('Cannot archive the only personal profile');
      }
    }

    const archived = await this.profileRepository.archive(profileId, userId);
    if (!archived) {
      throw new NotFoundException('Profile not found');
    }

    this.logger.log('Profile archived', { userId, profileId });
  }

  /**
   * Create default personal profile for new user
   */
  async createPersonalProfile(
    userId: string,
    userData: {
      firstName: string;
      currency?: string;
      timezone?: string;
    }
  ): Promise<ProfileResponseDto> {
    const createProfileDto: CreateProfileDto = {
      type: ProfileType.PERSONAL,
      name: `${userData.firstName} Personal`,
      currency: userData.currency || 'USD',
      timezone: userData.timezone || 'America/Argentina/Buenos_Aires',
      description: 'Personal transactions and income'
    };

    return this.create(userId, createProfileDto);
  }

  /**
   * Update profile's last used timestamp
   */
  async updateLastUsed(profileId: string): Promise<void> {
    await this.profileRepository.updateLastUsed(profileId);
  }

  /**
   * Find profile by name pattern (for WhatsApp @mentions)
   */
  async findByNamePattern(userId: string, namePattern: string): Promise<ProfileResponseDto | null> {
    const profile = await this.profileRepository.findByNamePattern(userId, namePattern);
    return profile ? this.mapToResponseDto(profile) : null;
  }

  /**
   * Validate if user can create a profile of given type
   */
  private async validateProfileCreation(userId: string, type: ProfileType): Promise<void> {
    const existingCount = await this.profileRepository.countByType(userId, type);

    // Business and family can have multiple, but validate limits
    switch (type) {
      case ProfileType.PERSONAL:
        if (existingCount >= 1) {
          throw new ConflictException('User can only have one personal profile');
        }
        break;

      case ProfileType.COUPLE:
        if (existingCount >= 1) {
          throw new ConflictException('User can only have one couple profile');
        }
        break;

      case ProfileType.FAMILY:
        if (existingCount >= 3) {
          throw new ConflictException('User can have maximum 3 family profiles');
        }
        break;

      case ProfileType.BUSINESS:
        if (existingCount >= 5) {
          throw new ConflictException('User can have maximum 5 business profiles');
        }
        break;
    }
  }

  /**
   * Get default settings for profile type
   */
  private getDefaultSettings(type: ProfileType, providedSettings?: any): any {
    const defaultSettings = {
      privacy: {},
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
    };

    // Type-specific defaults
    switch (type) {
      case ProfileType.PERSONAL:
        defaultSettings.privacy = {
          transactionVisibility: 'private',
          reportVisibility: 'private',
          budgetVisibility: 'private',
          allowPrivateTransactions: true
        };
        break;

      case ProfileType.COUPLE:
        defaultSettings.privacy = {
          transactionVisibility: 'members_only',
          reportVisibility: 'members_only',
          budgetVisibility: 'members_only',
          allowPrivateTransactions: true
        };
        break;

      case ProfileType.FAMILY:
        defaultSettings.privacy = {
          transactionVisibility: 'members_only',
          reportVisibility: 'members_only',
          budgetVisibility: 'members_only',
          childTransactionLimit: 50,
          allowPrivateTransactions: false
        };
        break;

      case ProfileType.BUSINESS:
        defaultSettings.privacy = {
          transactionVisibility: 'members_only',
          reportVisibility: 'members_only',
          budgetVisibility: 'members_only',
          requireApproval: true,
          approvalThreshold: 500
        };
        break;
    }

    // Merge with provided settings
    return {
      privacy: { ...defaultSettings.privacy, ...(providedSettings?.privacy || {}) },
      notifications: { ...defaultSettings.notifications, ...(providedSettings?.notifications || {}) },
      preferences: { ...defaultSettings.preferences, ...(providedSettings?.preferences || {}) }
    };
  }

  /**
   * Find profile by ID (for internal use)
   */
  async findById(profileId: string): Promise<ProfileDocument | null> {
    return await this.profileRepository.findById(profileId);
  }

  /**
   * Find profiles by user ID (alias for findAllByUser for compatibility)
   */
  async findByUserId(userId: string): Promise<ProfileResponseDto[]> {
    return await this.findAllByUser(userId);
  }

  /**
   * Map profile document to response DTO
   */
  private mapToResponseDto(profile: ProfileDocument): ProfileResponseDto {
    return {
      id: profile._id.toString(),
      userId: profile.userId.toString(),
      type: profile.type,
      name: profile.name,
      description: profile.description,
      currency: profile.currency,
      timezone: profile.timezone,
      settings: profile.settings,
      members: profile.members.map(member => member.toString()),
      status: profile.status,
      totalMembers: profile.totalMembers,
      isPersonal: profile.isPersonal,
      isShared: profile.isShared,
      lastUsedAt: profile.lastUsedAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };
  }
}
