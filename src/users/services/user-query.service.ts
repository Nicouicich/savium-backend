import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { UserProfile, UserProfileDocument } from '../schemas/user-profile.schema';

/**
 * UserQueryService - Handles all database queries for User entities
 * Following SOLID principles - Single Responsibility for data access
 */
@Injectable()
export class UserQueryService {
  private readonly logger = new Logger(UserQueryService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name)
    private readonly userProfileModel: Model<UserProfileDocument>
  ) {}

  /**
   * Find user by ID with optional population
   */
  async findById(id: string, populate?: string[]): Promise<UserDocument | null> {
    if (!populate || populate.length === 0) {
      // Simple query without population
      return this.userModel.findById(id).exec();
    }

    // Use optimized aggregation pipeline for population (PERF-001)
    const pipeline: PipelineStage[] = [
      {
        $match: { _id: new Types.ObjectId(id) }
      }
    ];

    // Add lookups based on requested populate paths
    populate.forEach(path => {
      if (path === 'activeProfile') {
        pipeline.push({
          $lookup: {
            from: 'userprofiles',
            localField: 'activeProfileId',
            foreignField: '_id',
            as: 'activeProfile'
          }
        } as PipelineStage);
        pipeline.push({
          $addFields: {
            activeProfile: { $arrayElemAt: ['$activeProfile', 0] }
          }
        } as PipelineStage);
      } else if (path === 'userProfiles' || path === 'profiles') {
        pipeline.push({
          $lookup: {
            from: 'userprofiles',
            localField: 'profiles',
            foreignField: '_id',
            as: 'userProfiles'
          }
        } as PipelineStage);
      }
      // Add more populate paths as needed
    });

    const results = await this.userModel.aggregate(pipeline).exec();
    return results[0] || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Find user by email including password field
   */
  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+password').exec();
  }

  /**
   * Find user by OAuth provider
   */
  async findByOAuthProvider(provider: string, providerId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        oauthProvider: provider,
        oauthProviderId: providerId
      })
      .exec();
  }

  /**
   * Find users by IDs (batch query)
   */
  async findByIds(ids: string[]): Promise<UserDocument[]> {
    return this.userModel
      .find({
        _id: { $in: ids.map(id => new Types.ObjectId(id)) }
      })
      .exec();
  }

  /**
   * Find users with pagination and filters
   */
  async findWithPagination(
    filter: any = {},
    page: number = 1,
    limit: number = 10,
    sort: any = { createdAt: -1 }
  ): Promise<{ users: UserDocument[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([this.userModel.find(filter).sort(sort).skip(skip).limit(limit).exec(), this.userModel.countDocuments(filter)]);

    return {
      users,
      total,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Find users by role
   */
  async findByRole(role: string): Promise<UserDocument[]> {
    return this.userModel.find({ role }).exec();
  }

  /**
   * Find users by status
   */
  async findByStatus(status: string): Promise<UserDocument[]> {
    return this.userModel.find({ status }).exec();
  }

  /**
   * Find users with active profiles
   */
  async findWithActiveProfiles(): Promise<UserDocument[]> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const pipeline: PipelineStage[] = [
      {
        $match: {
          activeProfileId: { $exists: true, $ne: null }
        }
      },
      {
        $lookup: {
          from: 'userprofiles',
          localField: 'activeProfileId',
          foreignField: '_id',
          as: 'activeProfile'
        }
      } as PipelineStage,
      {
        $addFields: {
          activeProfile: { $arrayElemAt: ['$activeProfile', 0] }
        }
      } as PipelineStage
    ];

    return this.userModel.aggregate(pipeline).exec();
  }

  /**
   * Search users by name or email
   */
  async searchUsers(query: string, limit: number = 10): Promise<UserDocument[]> {
    const searchRegex = new RegExp(query, 'i');

    return this.userModel
      .find({
        $or: [{ firstName: searchRegex }, { lastName: searchRegex }, { email: searchRegex }],
        isActive: true
      })
      .limit(limit)
      .exec();
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.userModel.countDocuments({
      email: email.toLowerCase()
    });
    return count > 0;
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    verified: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const [total, active, verified, roleStats, statusStats] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ isActive: true }),
      this.userModel.countDocuments({ isEmailVerified: true }),
      this.userModel.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      this.userModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);

    return {
      total,
      active,
      verified,
      byRole: roleStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byStatus: statusStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };
  }

  /**
   * Find users created within date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<UserDocument[]> {
    return this.userModel
      .find({
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      })
      .exec();
  }

  /**
   * Find users with profiles in specific accounts
   */
  async findByAccountIds(accountIds: string[]): Promise<UserDocument[]> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const pipeline: PipelineStage[] = [
      {
        $match: {
          accounts: {
            $in: accountIds.map(id => new Types.ObjectId(id))
          }
        }
      },
      {
        $lookup: {
          from: 'userprofiles',
          localField: 'activeProfileId',
          foreignField: '_id',
          as: 'activeProfile'
        }
      } as PipelineStage,
      {
        $addFields: {
          activeProfile: { $arrayElemAt: ['$activeProfile', 0] }
        }
      } as PipelineStage
    ];

    return this.userModel.aggregate(pipeline).exec();
  }
}
