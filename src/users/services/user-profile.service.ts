import {Injectable, Logger, NotFoundException, BadRequestException} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Model, Types} from 'mongoose';

import {UserProfile, UserProfileDocument} from '../schemas/user-profile.schema';
import {User, UserDocument} from '../schemas/user.schema';

export interface CreateProfileDto {
  name: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  dateOfBirth?: Date;
  timezone?: string;
  locale?: string;
  profession?: string;
  company?: string;
  website?: string;
  profileType?: 'personal' | 'professional' | 'business' | 'family';
  privacy?: {
    visibility?: 'public' | 'private' | 'connections';
    showContactInfo?: boolean;
    showSocialLinks?: boolean;
    indexInSearchEngines?: boolean;
  };
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    instagram?: string;
  };
}

export interface UpdateProfileDto extends Partial<CreateProfileDto> {}

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectModel(UserProfile.name) private readonly userProfileModel: Model<UserProfileDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>
  ) {}

  async createProfile(userId: string, createProfileDto: CreateProfileDto): Promise<UserProfileDocument> {
    // Check if this is the first profile for the user
    const existingProfiles = await this.userProfileModel.find({userId: new Types.ObjectId(userId)});
    const isFirstProfile = existingProfiles.length === 0;

    // Create the new profile
    const profile = new this.userProfileModel({
      userId: new Types.ObjectId(userId),
      ...createProfileDto,
      isDefault: isFirstProfile, // First profile becomes default
      isActive: true,
      privacy: {
        visibility: 'private',
        showContactInfo: false,
        showSocialLinks: false,
        indexInSearchEngines: false,
        ...createProfileDto.privacy
      }
    });

    const savedProfile = await profile.save();

    // Update user's profile references
    await this.userModel.updateOne(
      {_id: new Types.ObjectId(userId)},
      {
        $push: {profiles: savedProfile._id},
        ...(isFirstProfile ? {activeProfileId: savedProfile._id} : {})
      }
    );

    this.logger.log(`Profile created for user: ${userId}, profileId: ${savedProfile._id}`);
    return savedProfile;
  }

  async getProfilesByUserId(userId: string): Promise<UserProfileDocument[]> {
    return this.userProfileModel
      .find({
        userId: new Types.ObjectId(userId),
        isActive: true
      })
      .sort({isDefault: -1, createdAt: -1});
  }

  async getProfileById(profileId: string): Promise<UserProfileDocument> {
    const profile = await this.userProfileModel.findOne({
      _id: new Types.ObjectId(profileId),
      isActive: true
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  async getActiveProfile(userId: string): Promise<UserProfileDocument | null> {
    const user = await this.userModel.findById(userId);
    if (!user || !user.activeProfileId) {
      return null;
    }

    return this.userProfileModel.findOne({
      _id: user.activeProfileId,
      isActive: true
    });
  }

  async getDefaultProfile(userId: string): Promise<UserProfileDocument | null> {
    return this.userProfileModel.findOne({
      userId: new Types.ObjectId(userId),
      isDefault: true,
      isActive: true
    });
  }

  async updateProfile(profileId: string, updateProfileDto: UpdateProfileDto): Promise<UserProfileDocument> {
    const updatedProfile = await this.userProfileModel.findOneAndUpdate(
      {_id: new Types.ObjectId(profileId), isActive: true},
      {$set: updateProfileDto},
      {new: true}
    );

    if (!updatedProfile) {
      throw new NotFoundException('Profile not found');
    }

    this.logger.log(`Profile updated: ${profileId}`);
    return updatedProfile;
  }

  async switchActiveProfile(userId: string, profileId: string): Promise<void> {
    // Verify the profile belongs to the user
    const profile = await this.userProfileModel.findOne({
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
      isActive: true
    });

    if (!profile) {
      throw new NotFoundException('Profile not found or does not belong to user');
    }

    // Update user's active profile
    await this.userModel.updateOne({_id: new Types.ObjectId(userId)}, {$set: {activeProfileId: new Types.ObjectId(profileId)}});

    this.logger.log(`Active profile switched for user: ${userId} to profile: ${profileId}`);
  }

  async setDefaultProfile(userId: string, profileId: string): Promise<void> {
    // Verify the profile belongs to the user
    const profile = await this.userProfileModel.findOne({
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
      isActive: true
    });

    if (!profile) {
      throw new NotFoundException('Profile not found or does not belong to user');
    }

    // Remove default from all other profiles of this user
    await this.userProfileModel.updateMany({userId: new Types.ObjectId(userId)}, {$set: {isDefault: false}});

    // Set this profile as default
    await this.userProfileModel.updateOne({_id: new Types.ObjectId(profileId)}, {$set: {isDefault: true}});

    this.logger.log(`Default profile set for user: ${userId} to profile: ${profileId}`);
  }

  async deleteProfile(userId: string, profileId: string): Promise<void> {
    // Check if this is the only profile
    const userProfiles = await this.getProfilesByUserId(userId);
    if (userProfiles.length <= 1) {
      throw new BadRequestException('Cannot delete the only profile. Users must have at least one profile.');
    }

    // Check if it's the active profile
    const user = await this.userModel.findById(userId);
    const isActiveProfile = user?.activeProfileId?.toString() === profileId;

    // Mark as inactive instead of hard delete
    await this.userProfileModel.updateOne(
      {
        _id: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId)
      },
      {$set: {isActive: false}}
    );

    // Remove from user's profile array
    await this.userModel.updateOne({_id: new Types.ObjectId(userId)}, {$pull: {profiles: new Types.ObjectId(profileId)}});

    // If this was the active profile, switch to default
    if (isActiveProfile) {
      const defaultProfile = await this.getDefaultProfile(userId);
      if (defaultProfile && (defaultProfile as any)._id.toString() !== profileId) {
        await this.switchActiveProfile(userId, (defaultProfile as any)._id.toString());
      } else {
        // Find any remaining profile and set as active
        const remainingProfiles = await this.getProfilesByUserId(userId);
        if (remainingProfiles.length > 0) {
          await this.switchActiveProfile(userId, (remainingProfiles[0] as any)._id.toString());
          await this.setDefaultProfile(userId, (remainingProfiles[0] as any)._id.toString());
        }
      }
    }

    this.logger.log(`Profile deleted for user: ${userId}, profileId: ${profileId}`);
  }

  async associateWithAccount(profileId: string, accountId: string): Promise<void> {
    await this.userProfileModel.updateOne({_id: new Types.ObjectId(profileId)}, {$addToSet: {associatedAccounts: new Types.ObjectId(accountId)}});
  }

  async dissociateFromAccount(profileId: string, accountId: string): Promise<void> {
    await this.userProfileModel.updateOne({_id: new Types.ObjectId(profileId)}, {$pull: {associatedAccounts: new Types.ObjectId(accountId)}});
  }

  async getProfilesByAccountId(accountId: string): Promise<UserProfileDocument[]> {
    return this.userProfileModel.find({
      associatedAccounts: new Types.ObjectId(accountId),
      isActive: true
    });
  }

  async searchProfiles(
    query: string,
    options?: {
      profileType?: string;
      privacy?: string;
      limit?: number;
      skip?: number;
    }
  ): Promise<UserProfileDocument[]> {
    const searchFilter: any = {
      isActive: true,
      'privacy.visibility': {$in: ['public', 'connections']}, // Don't include private profiles in search
      $text: {$search: query}
    };

    if (options?.profileType) {
      searchFilter.profileType = options.profileType;
    }

    return this.userProfileModel
      .find(searchFilter)
      .limit(options?.limit || 20)
      .skip(options?.skip || 0)
      .sort({score: {$meta: 'textScore'}})
      .exec();
  }

  async updateProfileMetadata(profileId: string, metadata: Record<string, any>): Promise<void> {
    await this.userProfileModel.updateOne({_id: new Types.ObjectId(profileId)}, {$set: {metadata}});
  }

  async getProfileStats(userId: string): Promise<any> {
    const profiles = await this.getProfilesByUserId(userId);
    const activeProfile = await this.getActiveProfile(userId);
    const defaultProfile = await this.getDefaultProfile(userId);

    return {
      totalProfiles: profiles.length,
      activeProfileId: activeProfile?._id,
      defaultProfileId: defaultProfile?._id,
      profileTypes: profiles.map(p => p.profileType)
    };
  }
}
