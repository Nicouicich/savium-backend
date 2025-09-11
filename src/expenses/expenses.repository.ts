import {Injectable} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Model, PipelineStage, Types, ClientSession} from 'mongoose';
import {Expense, ExpenseDocument} from './schemas/expense.schema';
import {CreateExpenseDto, ExpenseQueryDto, UpdateExpenseDto} from './dto';
import {Currency} from '@common/constants/expense-categories';

export interface ExpenseStats {
  totalAmount: number;
  totalExpenses: number;
  averageAmount: number;
  maxAmount: number;
  minAmount: number;
  currency: Currency;
  periodStart: Date;
  periodEnd: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

@Injectable()
export class ExpensesRepository {
  constructor(
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>
  ) {}

  async create(createExpenseDto: CreateExpenseDto, userId: string): Promise<ExpenseDocument> {
    const expense = new this.expenseModel({
      ...createExpenseDto,
      userId: new Types.ObjectId(userId),
      accountId: new Types.ObjectId(createExpenseDto.accountId),
      categoryId: new Types.ObjectId(createExpenseDto.categoryId),
      sharedWith: createExpenseDto.sharedWith?.map(id => new Types.ObjectId(id)) || [],
      metadata: {
        ...createExpenseDto.metadata,
        source: createExpenseDto.metadata?.source || 'manual'
      }
    });

    return expense.save();
  }

  async createWithSession(createExpenseDto: CreateExpenseDto, userId: string, session: ClientSession): Promise<ExpenseDocument> {
    const expense = new this.expenseModel({
      ...createExpenseDto,
      userId: new Types.ObjectId(userId),
      accountId: new Types.ObjectId(createExpenseDto.accountId),
      categoryId: new Types.ObjectId(createExpenseDto.categoryId),
      sharedWith: createExpenseDto.sharedWith?.map(id => new Types.ObjectId(id)) || [],
      metadata: {
        ...createExpenseDto.metadata,
        source: createExpenseDto.metadata?.source || 'manual'
      }
    });

    return expense.save({session});
  }

  async findById(id: string): Promise<ExpenseDocument | null> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const results = await this.getExpenseByIdWithAggregation(id);
    return results[0] || null;
  }

  async findMany(query: ExpenseQueryDto): Promise<PaginatedResult<ExpenseDocument>> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    // Reuse existing findManyOptimized method
    return this.findManyOptimized(query);
  }

  async findManyOptimized(query: ExpenseQueryDto): Promise<PaginatedResult<ExpenseDocument>> {
    const {page = 1, limit = 20, sortBy = 'date', sortOrder = 'desc', ...filters} = query;

    // Build MongoDB query for match stage
    const matchQuery = this.buildMongoQuery(filters);

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate skip
    const skip = (page - 1) * limit;

    // Optimized aggregation pipeline to avoid N+1 queries
    const aggregationPipeline: PipelineStage[] = [
      // Match stage (filter documents early)
      {$match: matchQuery},

      // Lookup user information
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{$project: {email: 1, firstName: 1, lastName: 1}}]
        }
      },

      // Lookup category information
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{$project: {name: 1, displayName: 1, icon: 1, color: 1}}]
        }
      },

      // Lookup shared users information
      {
        $lookup: {
          from: 'users',
          localField: 'sharedWith',
          foreignField: '_id',
          as: 'sharedUsers',
          pipeline: [{$project: {email: 1, firstName: 1, lastName: 1}}]
        }
      },

      // Lookup reviewer information
      {
        $lookup: {
          from: 'users',
          localField: 'reviewedBy',
          foreignField: '_id',
          as: 'reviewer',
          pipeline: [{$project: {email: 1, firstName: 1, lastName: 1}}]
        }
      },

      // Unwind single value lookups
      {
        $addFields: {
          userId: {$arrayElemAt: ['$user', 0]},
          categoryId: {$arrayElemAt: ['$category', 0]},
          reviewedBy: {$arrayElemAt: ['$reviewer', 0]},
          sharedWith: '$sharedUsers'
        }
      },

      // Remove temporary fields
      {
        $project: {
          user: 0,
          category: 0,
          reviewer: 0,
          sharedUsers: 0
        }
      },

      // Sort the results
      {$sort: sort},

      // Facet for pagination and counting
      {
        $facet: {
          data: [{$skip: skip}, {$limit: limit}],
          totalCount: [{$count: 'count'}]
        }
      }
    ];

    const [result] = await this.expenseModel.aggregate(aggregationPipeline).exec();

    const expenses = result.data;
    const total = result.totalCount[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: expenses,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto): Promise<ExpenseDocument | null> {
    const updateData: any = {...updateExpenseDto};

    if (updateExpenseDto.categoryId) {
      updateData.categoryId = new Types.ObjectId(updateExpenseDto.categoryId);
    }
    if (updateExpenseDto.sharedWith) {
      updateData.sharedWith = updateExpenseDto.sharedWith.map(id => new Types.ObjectId(id));
    }

    // Update the expense first
    await this.expenseModel.findByIdAndUpdate(id, updateData, {new: true}).exec();

    // Use optimized aggregation pipeline to get updated expense (PERF-001)
    const updatedExpenses = await this.getExpenseByIdWithAggregation(id);
    return updatedExpenses[0] || null;
  }

  async softDelete(id: string, deletedBy: string): Promise<ExpenseDocument | null> {
    return this.expenseModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: new Types.ObjectId(deletedBy)
        },
        {new: true}
      )
      .exec();
  }

  async findByAccount(
    accountId: string,
    options: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<PaginatedResult<ExpenseDocument>> {
    const query: ExpenseQueryDto = {
      accountId,
      ...(options as any)
    };

    return this.findMany(query);
  }

  async findByCategory(categoryId: string, accountId?: string, limit = 100): Promise<ExpenseDocument[]> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const matchQuery: any = {
      categoryId: new Types.ObjectId(categoryId),
      isDeleted: false
    };

    if (accountId) {
      matchQuery.accountId = new Types.ObjectId(accountId);
    }

    const pipeline: PipelineStage[] = [
      {$match: matchQuery},

      // Lookup user information
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{$project: {email: 1, firstName: 1, lastName: 1}}]
        }
      },

      // Lookup category information
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{$project: {name: 1, displayName: 1, icon: 1, color: 1}}]
        }
      },

      // Transform data
      {
        $addFields: {
          userId: {$arrayElemAt: ['$user', 0]},
          categoryId: {$arrayElemAt: ['$category', 0]}
        }
      },

      {$project: {user: 0, category: 0}},
      {$sort: {date: -1}},
      {$limit: limit}
    ];

    return this.expenseModel.aggregate(pipeline).exec();
  }

  async findByUser(userId: string, accountId?: string, limit = 100): Promise<ExpenseDocument[]> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const matchQuery: any = {
      userId: new Types.ObjectId(userId),
      isDeleted: false
    };

    if (accountId) {
      matchQuery.accountId = new Types.ObjectId(accountId);
    }

    const pipeline: PipelineStage[] = [
      {$match: matchQuery},

      // Lookup category information
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{$project: {name: 1, displayName: 1, icon: 1, color: 1}}]
        }
      },

      // Transform data
      {
        $addFields: {
          categoryId: {$arrayElemAt: ['$category', 0]}
        }
      },

      {$project: {category: 0}},
      {$sort: {date: -1}},
      {$limit: limit}
    ];

    return this.expenseModel.aggregate(pipeline).exec();
  }

  async getExpenseStats(accountId?: string, userId?: string, startDate?: Date, endDate?: Date, currency?: Currency): Promise<ExpenseStats> {
    const matchQuery: any = {isDeleted: false};

    if (accountId) {
      matchQuery.accountId = new Types.ObjectId(accountId);
    }
    if (userId) {
      matchQuery.userId = new Types.ObjectId(userId);
    }
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = startDate;
      if (endDate) matchQuery.date.$lte = endDate;
    }
    if (currency) {
      matchQuery.currency = currency;
    }

    const pipeline: PipelineStage[] = [
      {$match: matchQuery},
      {
        $group: {
          _id: null,
          totalAmount: {$sum: '$amount'},
          totalExpenses: {$sum: 1},
          averageAmount: {$avg: '$amount'},
          maxAmount: {$max: '$amount'},
          minAmount: {$min: '$amount'},
          minDate: {$min: '$date'},
          maxDate: {$max: '$date'}
        }
      }
    ];

    const [result] = await this.expenseModel.aggregate(pipeline);

    if (!result) {
      return {
        totalAmount: 0,
        totalExpenses: 0,
        averageAmount: 0,
        maxAmount: 0,
        minAmount: 0,
        currency: currency || Currency.USD,
        periodStart: startDate || new Date(),
        periodEnd: endDate || new Date()
      };
    }

    return {
      totalAmount: result.totalAmount || 0,
      totalExpenses: result.totalExpenses || 0,
      averageAmount: result.averageAmount || 0,
      maxAmount: result.maxAmount || 0,
      minAmount: result.minAmount || 0,
      currency: currency || Currency.USD,
      periodStart: startDate || result.minDate || new Date(),
      periodEnd: endDate || result.maxDate || new Date()
    };
  }

  async getCategoryBreakdown(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<{
      categoryId: string;
      categoryName: string;
      categoryIcon: string;
      categoryColor: string;
      totalAmount: number;
      expenseCount: number;
      percentage: number;
    }>
  > {
    const matchQuery: any = {
      accountId: new Types.ObjectId(accountId),
      isDeleted: false
    };

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = startDate;
      if (endDate) matchQuery.date.$lte = endDate;
    }

    const pipeline: PipelineStage[] = [
      {$match: matchQuery},
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      {$unwind: '$category'},
      {
        $group: {
          _id: '$categoryId',
          categoryName: {$first: '$category.displayName'},
          categoryIcon: {$first: '$category.icon'},
          categoryColor: {$first: '$category.color'},
          totalAmount: {$sum: '$amount'},
          expenseCount: {$sum: 1}
        }
      },
      {
        $lookup: {
          from: 'expenses',
          pipeline: [{$match: matchQuery}, {$group: {_id: null, grandTotal: {$sum: '$amount'}}}],
          as: 'grandTotal'
        }
      },
      {
        $addFields: {
          percentage: {
            $multiply: [
              {
                $divide: ['$totalAmount', {$arrayElemAt: ['$grandTotal.grandTotal', 0]}]
              },
              100
            ]
          }
        }
      },
      {$sort: {totalAmount: -1}}
    ];

    const results = await this.expenseModel.aggregate(pipeline);

    return results.map(result => ({
      categoryId: result._id.toString(),
      categoryName: result.categoryName,
      categoryIcon: result.categoryIcon,
      categoryColor: result.categoryColor,
      totalAmount: result.totalAmount,
      expenseCount: result.expenseCount,
      percentage: Math.round(result.percentage * 100) / 100
    }));
  }

  async getMonthlyTrends(
    accountId: string,
    months = 12
  ): Promise<
    Array<{
      year: number;
      month: number;
      totalAmount: number;
      expenseCount: number;
      averageAmount: number;
    }>
  > {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const pipeline: PipelineStage[] = [
      {
        $match: {
          accountId: new Types.ObjectId(accountId),
          isDeleted: false,
          date: {$gte: startDate}
        }
      },
      {
        $group: {
          _id: {
            year: {$year: '$date'},
            month: {$month: '$date'}
          },
          totalAmount: {$sum: '$amount'},
          expenseCount: {$sum: 1},
          averageAmount: {$avg: '$amount'}
        }
      },
      {
        $sort: {'_id.year': 1, '_id.month': 1}
      }
    ];

    const results = await this.expenseModel.aggregate(pipeline);

    return results.map(result => ({
      year: result._id.year,
      month: result._id.month,
      totalAmount: result.totalAmount,
      expenseCount: result.expenseCount,
      averageAmount: Math.round(result.averageAmount * 100) / 100
    }));
  }

  async findRecurringExpenses(accountId: string): Promise<ExpenseDocument[]> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const pipeline: PipelineStage[] = [
      {
        $match: {
          accountId: new Types.ObjectId(accountId),
          isRecurring: true,
          'recurringPattern.nextOccurrence': {$lte: new Date()},
          isDeleted: false
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{$project: {name: 1, displayName: 1, icon: 1, color: 1}}]
        }
      },
      {
        $addFields: {
          categoryId: {$arrayElemAt: ['$category', 0]}
        }
      },
      {$project: {category: 0}},
      {$sort: {'recurringPattern.nextOccurrence': 1}}
    ];

    return this.expenseModel.aggregate(pipeline).exec();
  }

  async updateRecurringExpense(expenseId: string, nextOccurrence: Date): Promise<ExpenseDocument | null> {
    return this.expenseModel.findByIdAndUpdate(expenseId, {'recurringPattern.nextOccurrence': nextOccurrence}, {new: true}).exec();
  }

  async updateRecurringExpenseWithSession(expenseId: string, nextOccurrence: Date, session: ClientSession): Promise<ExpenseDocument | null> {
    return this.expenseModel.findByIdAndUpdate(expenseId, {'recurringPattern.nextOccurrence': nextOccurrence}, {new: true, session}).exec();
  }

  async findExpensesNeedingReview(accountId: string): Promise<ExpenseDocument[]> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const pipeline: PipelineStage[] = [
      {
        $match: {
          accountId: new Types.ObjectId(accountId),
          needsReview: true,
          isDeleted: false
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{$project: {email: 1, firstName: 1, lastName: 1}}]
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{$project: {name: 1, displayName: 1, icon: 1, color: 1}}]
        }
      },
      {
        $addFields: {
          userId: {$arrayElemAt: ['$user', 0]},
          categoryId: {$arrayElemAt: ['$category', 0]}
        }
      },
      {$project: {user: 0, category: 0}},
      {$sort: {createdAt: -1}}
    ];

    return this.expenseModel.aggregate(pipeline).exec();
  }

  async markAsReviewed(expenseId: string, reviewedBy: string, approved = true): Promise<ExpenseDocument | null> {
    return this.expenseModel
      .findByIdAndUpdate(
        expenseId,
        {
          needsReview: false,
          reviewedBy: new Types.ObjectId(reviewedBy),
          reviewedAt: new Date(),
          status: approved ? 'approved' : 'rejected'
        },
        {new: true}
      )
      .exec();
  }

  async searchExpenses(searchTerm: string, accountId?: string, limit = 50): Promise<ExpenseDocument[]> {
    // Use MongoDB text search for better performance
    const query: any = {
      $text: {$search: searchTerm},
      isDeleted: false
    };

    if (accountId) {
      query.accountId = new Types.ObjectId(accountId);
    }

    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const pipeline: PipelineStage[] = [
      {
        $match: query
      },
      {
        $addFields: {
          score: {$meta: 'textScore'}
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{$project: {email: 1, firstName: 1, lastName: 1}}]
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{$project: {name: 1, displayName: 1, icon: 1, color: 1}}]
        }
      },
      {
        $addFields: {
          userId: {$arrayElemAt: ['$user', 0]},
          categoryId: {$arrayElemAt: ['$category', 0]}
        }
      },
      {$project: {user: 0, category: 0}},
      {
        $sort: {
          score: -1, // Sort by relevance first
          date: -1 // Then by date for equal scores
        }
      },
      {$limit: limit}
    ];

    return this.expenseModel.aggregate(pipeline).exec();
  }

  private buildMongoQuery(filters: Partial<ExpenseQueryDto>): any {
    const query: any = {isDeleted: false};

    if (filters.accountId) {
      query.accountId = new Types.ObjectId(filters.accountId);
    }

    if (filters.categoryId) {
      query.categoryId = new Types.ObjectId(filters.categoryId);
    }

    if (filters.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }

    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) {
        query.date.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.date.$lte = filters.endDate;
      }
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      query.amount = {};
      if (filters.minAmount !== undefined) {
        query.amount.$gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        query.amount.$lte = filters.maxAmount;
      }
    }

    if (filters.paymentMethod) {
      query.paymentMethod = filters.paymentMethod;
    }

    if (filters.currency) {
      query.currency = filters.currency;
    }

    if (filters.vendor) {
      query.vendor = new RegExp(filters.vendor, 'i');
    }

    if (filters.search) {
      // Use MongoDB text search for better performance
      query.$text = {$search: filters.search};
    }

    if (filters.tags) {
      const tagArray = filters.tags.split(',').map(tag => tag.trim());
      query['metadata.tags'] = {$in: tagArray};
    }

    // Boolean filters
    const booleanFields = ['isRecurring', 'isSharedExpense', 'isPrivate', 'isFlagged', 'needsReview'];

    booleanFields.forEach(field => {
      if (filters[field as keyof ExpenseQueryDto] !== undefined) {
        query[field] = filters[field as keyof ExpenseQueryDto];
      }
    });

    if (filters.status) {
      query.status = filters.status;
    }

    return query;
  }

  /**
   * PERF-001: Optimized aggregation pipeline for single expense lookup
   * Replaces multiple populate() calls with efficient $lookup operations
   */
  private async getExpenseByIdWithAggregation(id: string): Promise<any[]> {
    const pipeline: PipelineStage[] = [
      // Match specific expense
      {
        $match: {
          _id: new Types.ObjectId(id),
          isDeleted: false
        }
      },

      // Lookup user information
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
          pipeline: [{$project: {email: 1, firstName: 1, lastName: 1}}]
        }
      },

      // Lookup category information
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{$project: {name: 1, displayName: 1, icon: 1, color: 1}}]
        }
      },

      // Lookup shared users information
      {
        $lookup: {
          from: 'users',
          localField: 'sharedWith',
          foreignField: '_id',
          as: 'sharedUsers',
          pipeline: [{$project: {email: 1, firstName: 1, lastName: 1}}]
        }
      },

      // Lookup reviewer information
      {
        $lookup: {
          from: 'users',
          localField: 'reviewedBy',
          foreignField: '_id',
          as: 'reviewer',
          pipeline: [{$project: {email: 1, firstName: 1, lastName: 1}}]
        }
      },

      // Transform the data to match populate structure
      {
        $addFields: {
          userId: {$arrayElemAt: ['$user', 0]},
          categoryId: {$arrayElemAt: ['$category', 0]},
          reviewedBy: {$arrayElemAt: ['$reviewer', 0]},
          sharedWith: '$sharedUsers'
        }
      },

      // Remove temporary fields
      {
        $project: {
          user: 0,
          category: 0,
          reviewer: 0,
          sharedUsers: 0
        }
      }
    ];

    return this.expenseModel.aggregate(pipeline).exec();
  }
}
