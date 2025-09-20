import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profile, ProfileDocument } from './schemas/profile.schema';
import { ProfileType } from 'src/financial-profiles/schemas';

@Injectable()
export class ProfileRepository {
  private readonly logger = new Logger(ProfileRepository.name);

  constructor(@InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>) {}

  /**
   * Create a new profile
   */
  async create(profileData: Partial<Profile>): Promise<ProfileDocument> {
    this.logger.log('Creating profile in repository', {
      userId: profileData.userId,
      type: profileData.type
    });

    const profile = new this.profileModel(profileData);
    return profile.save();
  }

  /**
   * Find all active profiles for a user
   */
  async findAllByUser(userId: string): Promise<ProfileDocument[]> {
    return this.profileModel
      .find({
        userId: new Types.ObjectId(userId),
        status: 'active'
      })
      .sort({ lastUsedAt: -1 })
      .exec();
  }

  /**
   * Find profile by ID and user ID
   */
  async findOne(profileId: string, userId: string): Promise<ProfileDocument | null> {
    return this.profileModel
      .findOne({
        _id: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        status: 'active'
      })
      .exec();
  }

  /**
   * Find profiles by type for a user
   */
  async findByType(userId: string, type: ProfileType): Promise<ProfileDocument[]> {
    return this.profileModel
      .find({
        userId: new Types.ObjectId(userId),
        type,
        status: 'active'
      })
      .sort({ lastUsedAt: -1 })
      .exec();
  }

  /**
   * Find profiles by type and count for validation
   */
  async countByType(userId: string, type: ProfileType): Promise<number> {
    return this.profileModel
      .countDocuments({
        userId: new Types.ObjectId(userId),
        type,
        status: 'active'
      })
      .exec();
  }

  /**
   * Update profile by ID
   */
  async update(profileId: string, userId: string, updateData: Partial<Profile>): Promise<ProfileDocument | null> {
    const profile = await this.profileModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(profileId),
          userId: new Types.ObjectId(userId),
          status: 'active'
        },
        {
          ...updateData,
          lastUsedAt: new Date()
        },
        {
          new: true,
          runValidators: true
        }
      )
      .exec();

    if (profile) {
      this.logger.log('Profile updated in repository', {
        profileId,
        userId,
        changes: Object.keys(updateData)
      });
    }

    return profile;
  }

  /**
   * Update only lastUsedAt timestamp
   */
  async updateLastUsed(profileId: string): Promise<void> {
    await this.profileModel.findByIdAndUpdate(new Types.ObjectId(profileId), { lastUsedAt: new Date() }).exec();
  }

  /**
   * Archive profile (soft delete)
   */
  async archive(profileId: string, userId: string): Promise<boolean> {
    const result = await this.profileModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(profileId),
          userId: new Types.ObjectId(userId)
        },
        { status: 'archived' },
        { new: true }
      )
      .exec();

    if (result) {
      this.logger.log('Profile archived in repository', { profileId, userId });
      return true;
    }

    return false;
  }

  /**
   * Find profile by name pattern (for AI/messaging integrations)
   */
  async findByNamePattern(userId: string, namePattern: string): Promise<ProfileDocument | null> {
    return this.profileModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: 'active',
        name: { $regex: new RegExp(namePattern, 'i') }
      })
      .exec();
  }

  /**
   * Find profile by ID only (without user validation)
   */
  async findById(profileId: string): Promise<ProfileDocument | null> {
    return this.profileModel
      .findOne({
        _id: new Types.ObjectId(profileId),
        status: 'active'
      })
      .exec();
  }

  /**
   * Check if profile exists and belongs to user
   */
  async existsForUser(profileId: string, userId: string): Promise<boolean> {
    const count = await this.profileModel
      .countDocuments({
        _id: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        status: 'active'
      })
      .exec();

    return count > 0;
  }

  /**
   * Get user's most recently used profile
   */
  async findMostRecentByUser(userId: string): Promise<ProfileDocument | null> {
    return this.profileModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: 'active'
      })
      .sort({ lastUsedAt: -1 })
      .exec();
  }

  /**
   * Get profile with member details populated
   */
  async findWithMembers(profileId: string, userId: string): Promise<ProfileDocument | null> {
    return this.profileModel
      .findOne({
        _id: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        status: 'active'
      })
      .populate('members', 'firstName lastName email')
      .exec();
  }

  /**
   * Add member to profile
   */
  async addMember(profileId: string, userId: string, memberUserId: string): Promise<ProfileDocument | null> {
    return this.profileModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(profileId),
          userId: new Types.ObjectId(userId),
          status: 'active'
        },
        {
          $addToSet: { members: new Types.ObjectId(memberUserId) },
          lastUsedAt: new Date()
        },
        {
          new: true,
          runValidators: true
        }
      )
      .exec();
  }

  /**
   * Remove member from profile
   */
  async removeMember(profileId: string, userId: string, memberUserId: string): Promise<ProfileDocument | null> {
    return this.profileModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(profileId),
          userId: new Types.ObjectId(userId),
          status: 'active'
        },
        {
          $pull: { members: new Types.ObjectId(memberUserId) },
          lastUsedAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Add transaction reference to profile
   */
  async addTransaction(profileId: string, transactionId: string): Promise<void> {
    await this.profileModel
      .findByIdAndUpdate(new Types.ObjectId(profileId), {
        $addToSet: { transactions: new Types.ObjectId(transactionId) },
        lastUsedAt: new Date()
      })
      .exec();
  }

  /**
   * Remove transaction reference from profile
   */
  async removeTransaction(profileId: string, transactionId: string): Promise<void> {
    await this.profileModel
      .findByIdAndUpdate(new Types.ObjectId(profileId), {
        $pull: { transactions: new Types.ObjectId(transactionId) }
      })
      .exec();
  }

  /**
   * Add budget reference to profile
   */
  async addBudget(profileId: string, budgetId: string): Promise<void> {
    await this.profileModel
      .findByIdAndUpdate(new Types.ObjectId(profileId), {
        $addToSet: { budgets: new Types.ObjectId(budgetId) },
        lastUsedAt: new Date()
      })
      .exec();
  }

  /**
   * Add goal reference to profile
   */
  async addGoal(profileId: string, goalId: string): Promise<void> {
    await this.profileModel
      .findByIdAndUpdate(new Types.ObjectId(profileId), {
        $addToSet: { goals: new Types.ObjectId(goalId) },
        lastUsedAt: new Date()
      })
      .exec();
  }

  /**
   * Add category reference to profile
   */
  async addCategory(profileId: string, categoryId: string): Promise<void> {
    await this.profileModel
      .findByIdAndUpdate(new Types.ObjectId(profileId), {
        $addToSet: { categories: new Types.ObjectId(categoryId) }
      })
      .exec();
  }

  /**
   * Get profiles statistics for analytics
   */
  async getProfileStats(userId: string): Promise<{
    total: number;
    byType: Record<ProfileType, number>;
    lastUsed: Date | null;
  }> {
    const profiles = await this.findAllByUser(userId);

    const stats = {
      total: profiles.length,
      byType: {
        [ProfileType.PERSONAL]: 0,
        [ProfileType.COUPLE]: 0,
        [ProfileType.FAMILY]: 0,
        [ProfileType.BUSINESS]: 0
      },
      lastUsed: null as Date | null
    };

    for (const profile of profiles) {
      stats.byType[profile.type]++;
      if (!stats.lastUsed || profile.lastUsedAt > stats.lastUsed) {
        stats.lastUsed = profile.lastUsedAt;
      }
    }

    return stats;
  }
}
