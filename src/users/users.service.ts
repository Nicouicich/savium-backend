import { Injectable, Logger, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './dto';
import { UserDocument } from './schemas/user.schema';
import { PaginationDto } from '@common/utils/pagination.util';
import { UserAuthService } from './services/user-auth.service';
import { UserProfileService, CreateProfileDto } from './services/user-profile.service';
import { UserQueryService } from './services/user-query.service';
import { UserCommandService } from './services/user-command.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userAuthService: UserAuthService,
    private readonly userProfileService: UserProfileService,
    private readonly userQueryService: UserQueryService,
    private readonly userCommandService: UserCommandService
  ) {}

  async create(createUserDto: CreateUserDto & { profile?: CreateProfileDto }): Promise<UserDocument> {
    // Check if user already exists
    const existingUser = await this.userQueryService.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create user using command service
    const user = await this.userCommandService.create(createUserDto);

    // Create authentication record
    await this.userAuthService.createAuthRecord(user.id);

    // Create default profile
    const defaultProfile: CreateProfileDto = createUserDto.profile || {
      name: `${user.firstName} ${user.lastName}`,
      profileType: 'personal',
      privacy: {
        visibility: 'private',
        showContactInfo: false,
        showSocialLinks: false,
        indexInSearchEngines: false
      }
    };

    const profile = await this.userProfileService.createProfile(user.id, defaultProfile);

    // Set as active profile
    await this.userProfileService.switchActiveProfile(user.id, profile.id);

    this.logger.log(`User created successfully: ${user.email} with profile: ${profile.id}`);
    return user;
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userQueryService.findById(id, ['activeProfile', 'profiles']);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument> {
    const user = await this.userQueryService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument> {
    const user = await this.userQueryService.findByEmailWithPassword(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAll(paginationDto: PaginationDto, filters?: any) {
    const page = paginationDto?.page || 1;
    const limit = paginationDto?.limit || 10;
    return this.userQueryService.findWithPagination(filters, page, limit);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument> {
    const updatedUser = await this.userCommandService.update(id, updateUserDto);
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`User updated successfully: ${updatedUser.email}`);
    return updatedUser;
  }

  async remove(id: string): Promise<void> {
    const result = await this.userCommandService.softDelete(id);
    if (!result) {
      throw new NotFoundException('User not found');
    }
    this.logger.log(`User deleted successfully: ${result.email}`);
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    await this.userCommandService.updatePassword(id, newPassword);
    await this.userCommandService.clearRefreshTokens(id);
    this.logger.log(`Password updated for user: ${id}`);
  }

  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userCommandService.updateLastLogin(id);
  }

  async addRefreshToken(id: string, refreshToken: string, deviceInfo?: { userAgent?: string; ipAddress?: string; deviceId?: string }): Promise<void> {
    await this.userAuthService.addRefreshToken(id, refreshToken, deviceInfo);
  }

  async removeRefreshToken(id: string, refreshToken: string): Promise<void> {
    await this.userAuthService.removeRefreshToken(id, refreshToken);
  }

  async clearAllRefreshTokens(id: string): Promise<void> {
    await this.userAuthService.clearAllRefreshTokens(id);
  }

  async validateRefreshToken(id: string, refreshToken: string): Promise<boolean> {
    return this.userAuthService.validateRefreshToken(id, refreshToken);
  }

  async verifyEmail(id: string): Promise<void> {
    await this.userAuthService.verifyEmail(id);
    // Also update user status
    await this.userCommandService.updateStatus(id, 'active');
    this.logger.log(`Email verified for user: ${id}`);
  }

  async setEmailVerificationToken(id: string, token: string): Promise<void> {
    await this.userAuthService.setEmailVerificationToken(id, token);
  }

  async setPasswordResetToken(id: string, token: string, expires: Date): Promise<void> {
    await this.userAuthService.setPasswordResetToken(id, token, expires);
  }

  async clearPasswordResetToken(id: string): Promise<void> {
    await this.userAuthService.clearPasswordResetToken(id);
  }

  async findByEmailVerificationToken(token: string): Promise<UserDocument | null> {
    const authRecord = await this.userAuthService.findByEmailVerificationToken(token);
    if (!authRecord) return null;
    return this.findById(authRecord.userId.toString());
  }

  async findByPasswordResetToken(token: string): Promise<UserDocument | null> {
    const authRecord = await this.userAuthService.findByPasswordResetToken(token);
    if (!authRecord) return null;
    return this.findById(authRecord.userId.toString());
  }

  async getUserStats() {
    return this.userQueryService.getUserStats();
  }

  // OAuth-related methods
  async createFromOAuth(oauthData: {
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    isEmailVerified: boolean;
    oauthProvider: string;
    oauthProviderId: string;
  }): Promise<UserDocument> {
    try {
      // Check if user already exists
      const existingUser = await this.userQueryService.findByEmail(oauthData.email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Create user with OAuth data

      const user = await this.userCommandService.createOAuthUser(oauthData);
      this.logger.log(`OAuth user created successfully: ${user.email}`);
      return user;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Error creating OAuth user: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create OAuth user');
    }
  }

  async findByOAuthProvider(provider: string, providerId: string): Promise<UserDocument | null> {
    return this.userQueryService.findByOAuthProvider(provider, providerId);
  }

  async updateOAuthInfo(
    id: string,
    oauthInfo: {
      provider: string;
      providerId: string;
      isEmailVerified: boolean;
    }
  ): Promise<void> {
    await this.userCommandService.updateOAuthInfo(id, oauthInfo);
    this.logger.log(`OAuth info updated for user: ${id}`);
  }

  async removeOAuthInfo(id: string, provider: string): Promise<void> {
    await this.userCommandService.removeOAuthInfo(id);
    this.logger.log(`OAuth info removed for user: ${id}, provider: ${provider}`);
  }

  // Profile Management Methods
  async createProfile(userId: string, profileData: CreateProfileDto): Promise<any> {
    return this.userProfileService.createProfile(userId, profileData);
  }

  async getProfiles(userId: string): Promise<any> {
    return this.userProfileService.getProfilesByUserId(userId);
  }

  async getActiveProfile(userId: string): Promise<any> {
    return this.userProfileService.getActiveProfile(userId);
  }

  async switchProfile(userId: string, profileId: string): Promise<void> {
    return this.userProfileService.switchActiveProfile(userId, profileId);
  }

  async updateProfile(profileId: string, updateData: any): Promise<any> {
    return this.userProfileService.updateProfile(profileId, updateData);
  }

  async deleteProfile(userId: string, profileId: string): Promise<void> {
    return this.userProfileService.deleteProfile(userId, profileId);
  }

  // Security Methods
  async enableTwoFactor(userId: string, secret: string, backupCodes: string[]): Promise<void> {
    await this.userAuthService.enableTwoFactor(userId, secret, backupCodes);
    // Update user preferences
    const user = await this.findById(userId);
    const updatedPreferences = {
      ...user.preferences,
      security: {
        ...user.preferences.security,
        twoFactorEnabled: true
      }
    };
    await this.userCommandService.updatePreferences(userId, updatedPreferences);
  }

  async disableTwoFactor(userId: string): Promise<void> {
    await this.userAuthService.disableTwoFactor(userId);
    // Update user preferences
    const user = await this.findById(userId);
    const updatedPreferences = {
      ...user.preferences,
      security: {
        ...user.preferences.security,
        twoFactorEnabled: false
      }
    };
    await this.userCommandService.updatePreferences(userId, updatedPreferences);
  }

  async getActiveSessions(userId: string): Promise<any[]> {
    return this.userAuthService.getActiveSessions(userId);
  }

  async revokeSession(userId: string, deviceId: string): Promise<void> {
    return this.userAuthService.revokeSession(userId, deviceId);
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    return this.userAuthService.isAccountLocked(userId);
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get('app.bcryptRounds', 12);
    return bcrypt.hash(password, saltRounds);
  }
}
