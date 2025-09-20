import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateBudgetDto } from './dto';
import { Budget, BudgetDocument, BudgetPeriod, BudgetStatus } from './schemas/budget.schema';

@Injectable()
export class BudgetsRepository {
  constructor(@InjectModel(Budget.name) private budgetModel: Model<BudgetDocument>) {}

  async create(budgetData: Partial<Budget>): Promise<BudgetDocument> {
    const budget = new this.budgetModel(budgetData);
    return budget.save();
  }

  async findById(id: string): Promise<BudgetDocument | null> {
    return this.budgetModel.findOne({ _id: id, isDeleted: false }).exec();
  }

  async findByIdWithAggregation(id: string): Promise<any[]> {
    const pipeline = [
      // Match specific budget
      {
        $match: {
          _id: new Types.ObjectId(id),
          isDeleted: false
        }
      },

      // Lookup account information
      {
        $lookup: {
          from: 'accounts',
          localField: 'accountId',
          foreignField: '_id',
          as: 'account',
          pipeline: [{ $project: { name: 1, type: 1 } }]
        }
      },

      // Lookup creator information
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Lookup allowed users information
      {
        $lookup: {
          from: 'users',
          localField: 'allowedUsers',
          foreignField: '_id',
          as: 'allowedUsersData',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Transform the data to match populate structure
      {
        $addFields: {
          accountId: { $arrayElemAt: ['$account', 0] },
          createdBy: { $arrayElemAt: ['$creator', 0] },
          allowedUsers: '$allowedUsersData'
        }
      },

      // Remove temporary fields
      {
        $project: {
          account: 0,
          creator: 0,
          allowedUsersData: 0
        }
      }
    ];

    return this.budgetModel.aggregate(pipeline).exec();
  }

  async findOverlappingBudgets(accountId: string, period: BudgetPeriod, startDate: Date, endDate: Date): Promise<BudgetDocument[]> {
    return this.budgetModel
      .find({
        accountId: new Types.ObjectId(accountId),
        period: period,
        isDeleted: false,
        $or: [
          {
            startDate: { $lte: endDate },
            endDate: { $gte: startDate }
          }
        ]
      })
      .exec();
  }

  async findWithAggregation(matchQuery: any, sort: any, skip: number, limit: number): Promise<{ data: any[]; total: number }> {
    const pipeline = [
      // Match stage - filter documents early
      { $match: matchQuery },

      // Lookup account information
      {
        $lookup: {
          from: 'accounts',
          localField: 'accountId',
          foreignField: '_id',
          as: 'account',
          pipeline: [{ $project: { name: 1, type: 1 } }]
        }
      },

      // Lookup creator information
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Lookup allowed users information
      {
        $lookup: {
          from: 'users',
          localField: 'allowedUsers',
          foreignField: '_id',
          as: 'allowedUsersData',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Transform the data to match populate structure
      {
        $addFields: {
          accountId: { $arrayElemAt: ['$account', 0] },
          createdBy: { $arrayElemAt: ['$creator', 0] },
          allowedUsers: '$allowedUsersData'
        }
      },

      // Remove temporary fields
      {
        $project: {
          account: 0,
          creator: 0,
          allowedUsersData: 0
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

    const [result] = await this.budgetModel.aggregate(pipeline).exec();

    return {
      data: result.data,
      total: result.totalCount[0]?.count || 0
    };
  }

  async findByAccountIds(accountIds: Types.ObjectId[]): Promise<BudgetDocument[]> {
    return this.budgetModel
      .find({
        accountId: { $in: accountIds },
        isDeleted: false
      })
      .exec();
  }

  async findTemplateById(templateId: string): Promise<BudgetDocument | null> {
    return this.budgetModel
      .findOne({
        _id: templateId,
        isTemplate: true,
        isDeleted: false
      })
      .exec();
  }

  async findBudgetsForAutoRenewal(): Promise<BudgetDocument[]> {
    return this.budgetModel
      .find({
        autoRenew: true,
        status: BudgetStatus.COMPLETED,
        endDate: { $lt: new Date() },
        isDeleted: false,
        renewedFromId: { $exists: false } // Haven't been renewed yet
      })
      .exec();
  }

  async updateById(id: string, updateData: any): Promise<BudgetDocument | null> {
    return this.budgetModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async softDelete(id: string, userId: string): Promise<BudgetDocument | null> {
    return this.budgetModel
      .findByIdAndUpdate(id, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId
      })
      .exec();
  }

  async save(budget: BudgetDocument): Promise<BudgetDocument> {
    return budget.save();
  }
}
