import { Injectable, Logger } from '@nestjs/common';
import { Document, Model, Types } from 'mongoose';
import { BaseProfile } from '../schemas/base-profile.schema';

@Injectable()
export abstract class BaseProfileRepository<T extends BaseProfile, TDocument extends T & Document = T & Document> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly model: Model<TDocument>) {}

  /**
   * Create a new profile
   */
  async create(profileData: Partial<T>): Promise<TDocument> {
    this.logger.log('Creating profile in repository', {
      userId: profileData.userId
    });

    const profile = new this.model(profileData);
    return profile.save();
  }

  /**
   * Find all active profiles for a user
   */
  async findAllByUser(userId: string): Promise<TDocument[]> {
    return this.model
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
  async findOne(profileId: string, userId: string): Promise<TDocument | null> {
    return this.model
      .findOne({
        _id: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
        status: 'active'
      })
      .exec();
  }

  /**
   * Count profiles for a user
   */
  async countByUser(userId: string): Promise<number> {
    return this.model
      .countDocuments({
        userId: new Types.ObjectId(userId),
        status: 'active'
      })
      .exec();
  }

  /**
   * Update profile by ID
   */
  async update(profileId: string, userId: string, updateData: Partial<T>): Promise<TDocument | null> {
    const profile = await this.model
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
    await this.model.findByIdAndUpdate(new Types.ObjectId(profileId), { lastUsedAt: new Date() }).exec();
  }

  /**
   * Archive profile (soft delete)
   */
  async archive(profileId: string, userId: string): Promise<boolean> {
    const result = await this.model
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
  async findByNamePattern(userId: string, namePattern: string): Promise<TDocument | null> {
    return this.model
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
  async findById(profileId: string): Promise<TDocument | null> {
    return this.model
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
    const count = await this.model
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
  async findMostRecentByUser(userId: string): Promise<TDocument | null> {
    return this.model
      .findOne({
        userId: new Types.ObjectId(userId),
        status: 'active'
      })
      .sort({ lastUsedAt: -1 })
      .exec();
  }
}
