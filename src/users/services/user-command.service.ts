import { ConflictException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { PersonalProfileRepository } from '../../financial-profiles/repositories/personal-profile.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserProfile, UserProfileDocument } from '../schemas/user-profile.schema';
import { User, UserDocument } from '../schemas/user.schema';

/**
 * UserCommandService - Handles all write operations for User entities
 * Following SOLID principles - Single Responsibility for data mutations
 */
@Injectable()
export class UserCommandService {
  private readonly logger = new Logger(UserCommandService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name) private readonly userProfileModel: Model<UserProfileDocument>,
    private readonly personalProfileRepository: PersonalProfileRepository
  ) {}

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    try {
      // Hash password if provided
      let hashedPassword: string | undefined;
      if (createUserDto.password) {
        hashedPassword = await bcrypt.hash(createUserDto.password, 12);
      }

      const userData = {
        ...createUserDto,
        password: hashedPassword,
        email: createUserDto.email.toLowerCase(),
        status: 'pending_verification',
        refreshTokens: [],
        referralCode: createUserDto.email.toLowerCase(), // Use email as default referral code
        lastActiveAt: new Date(),
        activeDaysCount: 0,
        preferences: {
          notifications: {
            email: true,
            push: true,
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
            theme: 'light',
            dateFormat: 'MM/DD/YYYY',
            timeFormat: '12h'
          },
          security: {
            twoFactorEnabled: false,
            sessionTimeout: 30,
            requirePasswordChange: false
          },
          ...createUserDto.preferences
        },
        termsAcceptedAt: new Date()
      };

      const user = new this.userModel(userData);
      const savedUser = await user.save();

      // Create default personal UserProfile automatically
      try {
        const personalProfile = await this.createDefaultProfile(savedUser);

        // Update user with the created profile
        await this.userModel.findByIdAndUpdate(savedUser._id, {
          activeProfileRef: personalProfile._id,
          activeProfileType: 'personal',
          personalProfile: personalProfile._id
        });

        this.logger.log(`Default UserProfile created for user: ${savedUser.email}, profileId: ${personalProfile._id}`);
      } catch (profileError) {
        this.logger.error(`Failed to create default profile for user ${savedUser.email}: ${profileError.message}`, profileError.stack);
        // Don't fail user creation if profile creation fails, but log it
      }

      this.logger.log(`User created successfully: ${savedUser.email}`);
      return savedUser;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Email already exists');
      }
      this.logger.error(`Error creating user: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  /**
   * Create OAuth user
   */
  async createOAuthUser(
    oauthData: {
      email: string;
      firstName: string;
      lastName: string;
      avatar?: string;
      oauthProvider: string;
      oauthProviderId: string;
      isEmailVerified?: boolean;
    }
  ): Promise<UserDocument> {
    try {
      const userData = {
        email: oauthData.email.toLowerCase(),
        firstName: oauthData.firstName,
        lastName: oauthData.lastName,
        avatar: oauthData.avatar,
        isEmailVerified: oauthData.isEmailVerified ?? true,
        oauthProvider: oauthData.oauthProvider,
        oauthProviderId: oauthData.oauthProviderId,
        password: undefined, // No password for OAuth users
        isActive: true,
        status: 'active',
        profiles: [],
        accounts: [],
        refreshTokens: [],
        referralCode: oauthData.email.toLowerCase(), // Use email as default referral code
        lastActiveAt: new Date(),
        activeDaysCount: 0,
        preferences: {
          notifications: {
            email: true,
            push: true,
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
            theme: 'light',
            dateFormat: 'MM/DD/YYYY',
            timeFormat: '12h'
          },
          security: {
            twoFactorEnabled: false,
            sessionTimeout: 30,
            requirePasswordChange: false
          }
        },
        termsAcceptedAt: new Date(),
        metadata: {}
      };

      const user = new this.userModel(userData);
      const savedUser = await user.save();

      // Create default personal UserProfile automatically
      try {
        const personalProfile = await this.createDefaultProfile(savedUser);

        // Update user with the created profile
        await this.userModel.findByIdAndUpdate(savedUser._id, {
          activeProfileRef: personalProfile._id,
          activeProfileType: 'personal',
          personalProfile: personalProfile._id
        });

        this.logger.log(`Default UserProfile created for OAuth user: ${savedUser.email}, profileId: ${personalProfile._id}`);
      } catch (profileError) {
        this.logger.error(`Failed to create default profile for OAuth user ${savedUser.email}: ${profileError.message}`, profileError.stack);
        // Don't fail OAuth user creation if profile creation fails, but log it
      }

      this.logger.log(`OAuth user created successfully: ${savedUser.email}`);
      return savedUser;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Email already exists');
      }
      this.logger.error(`Error creating OAuth user: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create OAuth user');
    }
  }

  /**
   * Update user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument | null> {
    try {
      const updateData: any = { ...updateUserDto };

      // Hash password if being updated
      if (updateUserDto.password) {
        updateData.password = await bcrypt.hash(updateUserDto.password, 12);
      }

      // Normalize email if being updated
      if (updateUserDto.email) {
        updateData.email = updateUserDto.email.toLowerCase();
      }

      const user = await this.userModel.findByIdAndUpdate(id, updateData, { new: true }).exec();

      if (user) {
        this.logger.log(`User updated successfully: ${user.email}`);
      }

      return user;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Email already exists');
      }
      this.logger.error(`Error updating user: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  /**
   * Delete user (soft delete)
   */
  async softDelete(id: string): Promise<UserDocument | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          isActive: false,
          status: 'deactivated'
        },
        { new: true }
      )
      .exec();

    if (user) {
      this.logger.log(`User soft deleted: ${user.email}`);
    }

    return user;
  }

  /**
   * Hard delete user
   */
  async hardDelete(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndDelete(id).exec();

    if (result) {
      this.logger.log(`User hard deleted: ${result.email}`);
      return true;
    }

    return false;
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, newPassword: string): Promise<UserDocument | null> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    return this.userModel.findByIdAndUpdate(id, { password: hashedPassword }, { new: true }).exec();
  }

  /**
   * Verify user email
   */
  async verifyEmail(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          isEmailVerified: true,
          status: 'active'
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Add refresh token
   */
  async addRefreshToken(id: string, refreshToken: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        $push: { refreshTokens: refreshToken }
      })
      .exec();
  }

  /**
   * Remove refresh token
   */
  async removeRefreshToken(id: string, refreshToken: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        $pull: { refreshTokens: refreshToken }
      })
      .exec();
  }

  /**
   * Clear all refresh tokens
   */
  async clearRefreshTokens(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        refreshTokens: []
      })
      .exec();
  }

  /**
   * Add profile to user
   */
  async addProfile(userId: string, profileId: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, { $addToSet: { profiles: new Types.ObjectId(profileId) } }, { new: true }).exec();
  }

  /**
   * Remove profile from user
   */
  async removeProfile(userId: string, profileId: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, { $pull: { profiles: new Types.ObjectId(profileId) } }, { new: true }).exec();
  }

  /**
   * Set active profile
   */
  async setActiveProfile(userId: string, profileId: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, { activeProfileId: new Types.ObjectId(profileId) }, { new: true }).exec();
  }

  /**
   * Add account to user
   */
  async addAccount(userId: string, accountId: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, { $addToSet: { accounts: new Types.ObjectId(accountId) } }, { new: true }).exec();
  }

  /**
   * Remove account from user
   */
  async removeAccount(userId: string, accountId: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, { $pull: { accounts: new Types.ObjectId(accountId) } }, { new: true }).exec();
  }

  /**
   * Update user preferences
   */
  async updatePreferences(id: string, preferences: any): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, { $set: { preferences } }, { new: true }).exec();
  }

  /**
   * Update user status
   */
  async updateStatus(id: string, status: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }

  /**
   * Internal update method for system operations (bypasses DTO validation)
   */
  async updateInternal(id: string, updateData: any): Promise<UserDocument | null> {
    try {
      const user = await this.userModel.findByIdAndUpdate(id, updateData, { new: true }).exec();

      if (user) {
        this.logger.log(`User updated internally: ${user.email}`);
      }

      return user;
    } catch (error) {
      this.logger.error(`Error in internal user update: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update user internally');
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.updateInternal(id, { updatedAt: new Date() });
  }

  /**
   * Update OAuth information
   */
  async updateOAuthInfo(
    id: string,
    oauthInfo: {
      provider: string;
      providerId: string;
      isEmailVerified: boolean;
    }
  ): Promise<void> {
    await this.updateInternal(id, {
      oauthProvider: oauthInfo.provider,
      oauthProviderId: oauthInfo.providerId,
      isEmailVerified: oauthInfo.isEmailVerified
    });
  }

  /**
   * Remove OAuth information
   */
  async removeOAuthInfo(id: string): Promise<void> {
    await this.updateInternal(id, {
      oauthProvider: undefined,
      oauthProviderId: undefined
    });
  }

  /**
   * Set active financial profile
   */
  async setActiveFinancialProfile(userId: string, profileId: string, profileType: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          activeProfileId: new Types.ObjectId(profileId),
          activeProfileType: profileType
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Create default UserProfile for new user
   */
  private async createDefaultProfile(user: UserDocument): Promise<any> {
    try {
      // Create a PersonalProfile using the new specialized schema
      const profileData = {
        userId: user._id as Types.ObjectId,
        name: `${user.firstName} ${user.lastName}`,
        displayName: user.firstName,
        isActive: true,
        isDefault: true,
        profileType: 'personal' as const,
        privacy: {
          visibility: 'private' as const,
          showContactInfo: false,
          showSocialLinks: false,
          indexInSearchEngines: false
        },
        associatedAccounts: [],
        metadata: {}
      };

      // Use PersonalProfileRepository to create the profile
      const savedProfile = await this.personalProfileRepository.create(profileData);

      this.logger.log(`Default PersonalProfile created: ${savedProfile._id} for user: ${user.email}`);
      return savedProfile;
    } catch (error) {
      this.logger.error(`Error creating default profile: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create default profile');
    }
  }
}
