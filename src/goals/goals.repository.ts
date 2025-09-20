import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Goal, GoalDocument } from './schemas/goal.schema';

@Injectable()
export class GoalsRepository {
  constructor(@InjectModel(Goal.name) private goalModel: Model<GoalDocument>) {}

  async create(goalData: Partial<Goal>): Promise<GoalDocument> {
    const goal = new this.goalModel(goalData);
    return goal.save();
  }

  async findById(id: string): Promise<GoalDocument | null> {
    return this.goalModel.findOne({ id: id, isDeleted: false }).exec();
  }

  async findByIdWithAggregation(id: string): Promise<any[]> {
    const pipeline = [
      // Match specific goal
      {
        $match: {
          id: id,
          isDeleted: false
        }
      },

      // Lookup profile information
      {
        $lookup: {
          from: 'userprofiles',
          localField: 'profileId',
          foreignField: '_id',
          as: 'profile',
          pipeline: [{ $project: { profileType: 1, displayName: 1 } }]
        }
      },

      // Lookup creator information
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: 'id',
          as: 'creator',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Lookup participants information
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: 'id',
          as: 'participantsData',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Transform the data to match populate structure
      {
        $addFields: {
          profileId: { $arrayElemAt: ['$profile', 0] },
          createdBy: { $arrayElemAt: ['$creator', 0] },
          participants: '$participantsData'
        }
      },

      // Remove temporary fields
      {
        $project: {
          profile: 0,
          creator: 0,
          participantsData: 0
        }
      }
    ];

    return this.goalModel.aggregate(pipeline).exec();
  }

  async findWithAggregation(matchQuery: any, sort: any, skip: number, limit: number): Promise<{ data: any[]; total: number }> {
    const pipeline = [
      // Match stage - filter documents early
      { $match: matchQuery },

      // Lookup profile information
      {
        $lookup: {
          from: 'userprofiles',
          localField: 'profileId',
          foreignField: '_id',
          as: 'profile',
          pipeline: [{ $project: { profileType: 1, displayName: 1 } }]
        }
      },

      // Lookup creator information
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: 'id',
          as: 'creator',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Lookup participants information
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: 'id',
          as: 'participantsData',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Transform the data to match populate structure
      {
        $addFields: {
          profileId: { $arrayElemAt: ['$profile', 0] },
          createdBy: { $arrayElemAt: ['$creator', 0] },
          participants: '$participantsData'
        }
      },

      // Remove temporary fields
      {
        $project: {
          profile: 0,
          creator: 0,
          participantsData: 0
        }
      },

      // Sort the results
      { $sort: sort },

      // Facet for pagination and counting
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [result] = await this.goalModel.aggregate(pipeline).exec();

    return {
      data: result.data,
      total: result.totalCount[0]?.count || 0
    };
  }

  async findByProfileId(profileId: string): Promise<GoalDocument[]> {
    return this.goalModel
      .find({
        profileId: profileId,
        isDeleted: false
      })
      .exec();
  }

  async updateById(id: string, updateData: any): Promise<GoalDocument | null> {
    return this.goalModel.findOneAndUpdate({ id: id }, updateData, { new: true }).exec();
  }

  async softDelete(id: string, userId: string): Promise<GoalDocument | null> {
    return this.goalModel
      .findOneAndUpdate(
        { id: id },
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId
        }
      )
      .exec();
  }

  async save(goal: GoalDocument): Promise<GoalDocument> {
    return goal.save();
  }

  async findAll(query: any): Promise<GoalDocument[]> {
    return this.goalModel.find(query).exec();
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    return this.goalModel.aggregate(pipeline).exec();
  }
}
