import { Currency } from '@common/constants/transaction-categories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, PipelineStage, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { CreateTransactionDto, TransactionQueryDto, UpdateTransactionDto } from './dto';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

export interface TransactionStats {
  totalAmount: number;
  totalTransactions: number;
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
export class TransactionsRepository {
  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>
  ) {}

  async create(createTransactionDto: CreateTransactionDto): Promise<TransactionDocument[]> {
    if (createTransactionDto.isInstallment && createTransactionDto.installment) {
      const { total } = createTransactionDto.installment;
      const installmentId = uuidv4();

      const baseAmount = +(createTransactionDto.amount / total).toFixed(2);
      const startDate = createTransactionDto.date || new Date();
      const transactions: TransactionDocument[] = [];
      for (let i = 0; i < total; i++) {
        const date = new Date(startDate);

        date.setMonth(startDate.getMonth() + i);

        const transaction = new this.transactionModel({
          ...createTransactionDto,
          amount: baseAmount,
          category: createTransactionDto.categoryId,
          date,
          isInstallment: true,
          installmentId,
          installment: {
            current: i + 1,
            total: total
          }
        });

        transactions.push(transaction);
      }

      return this.transactionModel.insertMany(transactions);
    }

    const payload = {
      ...createTransactionDto,
      category: createTransactionDto.categoryId
    };

    const transaction = new this.transactionModel(payload);
    return [await transaction.save()];
  }

  /*  async createWithSession(createTransactionDto: CreateTransactionDto, userId: string, session: ClientSession): Promise<TransactionDocument> {
     const transaction = new this.transactionModel({
       ...createTransactionDto,
       userId, // UUID string
       profileId: new Types.ObjectId(createTransactionDto.profileId),
       categoryId: new Types.ObjectId(createTransactionDto.categoryId),
       sharedWith: createTransactionDto.sharedWith || [], // UUID strings
       metadata: {
         ...createTransactionDto.metadata,
         source: createTransactionDto.metadata?.source || 'manual'
       }
     });

     return transaction.save({ session });
   } */

  async findById(id: string): Promise<TransactionDocument | null> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const results = await this.getTransactionByIdWithAggregation(id);
    return results[0] || null;
  }

  /*   async findMany(query: TransactionQueryDto): Promise<PaginatedResult<TransactionDocument>> {
      // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
      // Reuse existing findManyOptimized method
      return this.findManyOptimized(query);
    } */

  /*   async findManyOptimized(query: TransactionQueryDto): Promise<PaginatedResult<TransactionDocument>> {
      const { page = 1, limit = 20, sortBy = 'date', sortOrder = 'desc', ...filters } = query;

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
        { $match: matchQuery },

        // Lookup user information
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: 'uuid',
            as: 'user',
            pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1, uuid: 1 } }]
          }
        },

        // Lookup category information
        {
          $lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'category',
            pipeline: [{ $project: { name: 1, displayName: 1, icon: 1, color: 1 } }]
          }
        },

        // Lookup shared users information
        {
          $lookup: {
            from: 'users',
            localField: 'sharedWith',
            foreignField: 'uuid',
            as: 'sharedUsers',
            pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1, uuid: 1 } }]
          }
        },

        // Lookup reviewer information
        {
          $lookup: {
            from: 'users',
            localField: 'reviewedBy',
            foreignField: 'uuid',
            as: 'reviewer',
            pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1, uuid: 1 } }]
          }
        },

        // Unwind single value lookups
        {
          $addFields: {
            userId: { $arrayElemAt: ['$user', 0] },
            categoryId: { $arrayElemAt: ['$category', 0] },
            reviewedBy: { $arrayElemAt: ['$reviewer', 0] },
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
        { $sort: sort },

        // Facet for pagination and counting
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: 'count' }]
          }
        }
      ];

      const [result] = await this.transactionModel.aggregate(aggregationPipeline).exec();

      const transactions = result.data;
      const total = result.totalCount[0]?.count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: transactions,
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };
    } */

  /*   async update(id: string, updateTransactionDto: UpdateTransactionDto): Promise<TransactionDocument | null> {
      const updateData: any = { ...updateTransactionDto };

      if (updateTransactionDto.categoryId) {
        updateData.categoryId = new Types.ObjectId(updateTransactionDto.categoryId);
      }
      if (updateTransactionDto.sharedWith) {
        updateData.sharedWith = updateTransactionDto.sharedWith; // UUID strings
      }

      // Update the transaction first
      await this.transactionModel.findByIdAndUpdate(id, updateData, { new: true }).exec();

      // Use optimized aggregation pipeline to get updated transaction (PERF-001)
      const updatedTransactions = await this.getTransactionByIdWithAggregation(id);
      return updatedTransactions[0] || null;
    } */

  async softDelete(id: string, deletedBy: string): Promise<TransactionDocument | null> {
    return this.transactionModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy // UUID string
        },
        { new: true }
      )
      .exec();
  }

  /*   async findByProfile(
    profileId: string,
    options: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<PaginatedResult<TransactionDocument>> {
    const query: TransactionQueryDto = {
      profileId,
      ...(options as any)
    };

    return this.findMany(query);
  } */

  async findByCategory(categoryId: string, profileId?: string, limit = 100): Promise<TransactionDocument[]> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const matchQuery: any = {
      categoryId: new Types.ObjectId(categoryId),
      isDeleted: false
    };

    if (profileId) {
      matchQuery.profileId = new Types.ObjectId(profileId);
    }

    const pipeline: PipelineStage[] = [
      { $match: matchQuery },

      // Lookup user information
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'uuid',
          as: 'user',
          pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1, uuid: 1 } }]
        }
      },

      // Lookup category information
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1, displayName: 1, icon: 1, color: 1 } }]
        }
      },

      // Transform data
      {
        $addFields: {
          userId: { $arrayElemAt: ['$user', 0] },
          categoryId: { $arrayElemAt: ['$category', 0] }
        }
      },

      { $project: { user: 0, category: 0 } },
      { $sort: { date: -1 } },
      { $limit: limit }
    ];

    return this.transactionModel.aggregate(pipeline).exec();
  }

  async findByUser(userId: string, profileId?: string, limit = 100): Promise<TransactionDocument[]> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const matchQuery: any = {
      userId, // UUID string
      isDeleted: false
    };

    if (profileId) {
      matchQuery.profileId = new Types.ObjectId(profileId);
    }

    const pipeline: PipelineStage[] = [
      { $match: matchQuery },

      // Lookup category information
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1, displayName: 1, icon: 1, color: 1 } }]
        }
      },

      // Transform data
      {
        $addFields: {
          categoryId: { $arrayElemAt: ['$category', 0] }
        }
      },

      { $project: { category: 0 } },
      { $sort: { date: -1 } },
      { $limit: limit }
    ];

    return this.transactionModel.aggregate(pipeline).exec();
  }

  async getTransactionStats(profileId?: string, userId?: string, startDate?: Date, endDate?: Date, currency?: Currency): Promise<TransactionStats> {
    const matchQuery: any = { isDeleted: false };

    if (profileId) {
      matchQuery.profileId = new Types.ObjectId(profileId);
    }
    if (userId) {
      matchQuery.userId = userId; // UUID string
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
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          averageAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' },
          minDate: { $min: '$date' },
          maxDate: { $max: '$date' }
        }
      }
    ];

    const [result] = await this.transactionModel.aggregate(pipeline);

    if (!result) {
      return {
        totalAmount: 0,
        totalTransactions: 0,
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
      totalTransactions: result.totalTransactions || 0,
      averageAmount: result.averageAmount || 0,
      maxAmount: result.maxAmount || 0,
      minAmount: result.minAmount || 0,
      currency: currency || Currency.USD,
      periodStart: startDate || result.minDate || new Date(),
      periodEnd: endDate || result.maxDate || new Date()
    };
  }

  async getCategoryBreakdown(
    profileId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<{
      categoryId: string;
      categoryName: string;
      categoryIcon: string;
      categoryColor: string;
      totalAmount: number;
      transactionCount: number;
      percentage: number;
    }>
  > {
    const matchQuery: any = {
      profileId: new Types.ObjectId(profileId),
      isDeleted: false
    };

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = startDate;
      if (endDate) matchQuery.date.$lte = endDate;
    }

    const pipeline: PipelineStage[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$categoryId',
          categoryName: { $first: '$category.displayName' },
          categoryIcon: { $first: '$category.icon' },
          categoryColor: { $first: '$category.color' },
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'transactions',
          pipeline: [{ $match: matchQuery }, { $group: { _id: null, grandTotal: { $sum: '$amount' } } }],
          as: 'grandTotal'
        }
      },
      {
        $addFields: {
          percentage: {
            $multiply: [
              {
                $divide: ['$totalAmount', { $arrayElemAt: ['$grandTotal.grandTotal', 0] }]
              },
              100
            ]
          }
        }
      },
      { $sort: { totalAmount: -1 } }
    ];

    const results = await this.transactionModel.aggregate(pipeline);

    return results.map(result => ({
      categoryId: result._id.toString(),
      categoryName: result.categoryName,
      categoryIcon: result.categoryIcon,
      categoryColor: result.categoryColor,
      totalAmount: result.totalAmount,
      transactionCount: result.transactionCount,
      percentage: Math.round(result.percentage * 100) / 100
    }));
  }

  async getMonthlyTrends(
    profileId: string,
    months = 12
  ): Promise<
    Array<{
      year: number;
      month: number;
      totalAmount: number;
      transactionCount: number;
      averageAmount: number;
    }>
  > {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const pipeline: PipelineStage[] = [
      {
        $match: {
          profileId: new Types.ObjectId(profileId),
          isDeleted: false,
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ];

    const results = await this.transactionModel.aggregate(pipeline);

    return results.map(result => ({
      year: result._id.year,
      month: result._id.month,
      totalAmount: result.totalAmount,
      transactionCount: result.transactionCount,
      averageAmount: Math.round(result.averageAmount * 100) / 100
    }));
  }

  async findRecurringTransactions(profileId: string): Promise<TransactionDocument[]> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const pipeline: PipelineStage[] = [
      {
        $match: {
          profileId: new Types.ObjectId(profileId),
          isRecurring: true,
          'recurringPattern.nextOccurrence': { $lte: new Date() },
          isDeleted: false
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1, displayName: 1, icon: 1, color: 1 } }]
        }
      },
      {
        $addFields: {
          categoryId: { $arrayElemAt: ['$category', 0] }
        }
      },
      { $project: { category: 0 } },
      { $sort: { 'recurringPattern.nextOccurrence': 1 } }
    ];

    return this.transactionModel.aggregate(pipeline).exec();
  }

  async updateRecurringTransaction(transactionId: string, nextOccurrence: Date): Promise<TransactionDocument | null> {
    return this.transactionModel.findByIdAndUpdate(transactionId, { 'recurringPattern.nextOccurrence': nextOccurrence }, { new: true }).exec();
  }

  async updateRecurringTransactionWithSession(transactionId: string, nextOccurrence: Date, session: ClientSession): Promise<TransactionDocument | null> {
    return this.transactionModel.findByIdAndUpdate(transactionId, { 'recurringPattern.nextOccurrence': nextOccurrence }, { new: true, session }).exec();
  }

  async findTransactionsNeedingReview(profileId: string): Promise<TransactionDocument[]> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const pipeline: PipelineStage[] = [
      {
        $match: {
          profileId: new Types.ObjectId(profileId),
          needsReview: true,
          isDeleted: false
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'uuid',
          as: 'user',
          pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1, uuid: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1, displayName: 1, icon: 1, color: 1 } }]
        }
      },
      {
        $addFields: {
          userId: { $arrayElemAt: ['$user', 0] },
          categoryId: { $arrayElemAt: ['$category', 0] }
        }
      },
      { $project: { user: 0, category: 0 } },
      { $sort: { createdAt: -1 } }
    ];

    return this.transactionModel.aggregate(pipeline).exec();
  }

  async markAsReviewed(transactionId: string, reviewedBy: string, approved = true): Promise<TransactionDocument | null> {
    return this.transactionModel
      .findByIdAndUpdate(
        transactionId,
        {
          needsReview: false,
          reviewedBy, // UUID string
          reviewedAt: new Date(),
          status: approved ? 'approved' : 'rejected'
        },
        { new: true }
      )
      .exec();
  }

  async searchTransactions(searchTerm: string, profileId?: string, limit = 50): Promise<TransactionDocument[]> {
    // Use MongoDB text search for better performance
    const query: any = {
      $text: { $search: searchTerm },
      isDeleted: false
    };

    if (profileId) {
      query.profileId = new Types.ObjectId(profileId);
    }

    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const pipeline: PipelineStage[] = [
      {
        $match: query
      },
      {
        $addFields: {
          score: { $meta: 'textScore' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'uuid',
          as: 'user',
          pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1, uuid: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1, displayName: 1, icon: 1, color: 1 } }]
        }
      },
      {
        $addFields: {
          userId: { $arrayElemAt: ['$user', 0] },
          categoryId: { $arrayElemAt: ['$category', 0] }
        }
      },
      { $project: { user: 0, category: 0 } },
      {
        $sort: {
          score: -1, // Sort by relevance first
          date: -1 // Then by date for equal scores
        }
      },
      { $limit: limit }
    ];

    return this.transactionModel.aggregate(pipeline).exec();
  }

  private buildMongoQuery(filters: Partial<TransactionQueryDto>): any {
    const query: any = { isDeleted: false };

    if (filters.profileId) {
      query.profileId = new Types.ObjectId(filters.profileId);
    }

    if (filters.categoryId) {
      query.categoryId = new Types.ObjectId(filters.categoryId);
    }

    if (filters.userId) {
      query.userId = filters.userId; // UUID string
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
      query.$text = { $search: filters.search };
    }

    if (filters.tags) {
      const tagArray = filters.tags.split(',').map(tag => tag.trim());
      query['metadata.tags'] = { $in: tagArray };
    }

    // Boolean filters
    const booleanFields = ['isRecurring', 'isSharedTransaction', 'isPrivate', 'isFlagged', 'needsReview'];

    booleanFields.forEach(field => {
      if (filters[field as keyof TransactionQueryDto] !== undefined) {
        query[field] = filters[field as keyof TransactionQueryDto];
      }
    });

    if (filters.status) {
      query.status = filters.status;
    }

    return query;
  }

  /**
   * PERF-001: Optimized aggregation pipeline for single transaction lookup
   * Replaces multiple populate() calls with efficient $lookup operations
   */
  private async getTransactionByIdWithAggregation(id: string): Promise<any[]> {
    const pipeline: PipelineStage[] = [
      // Match specific transaction
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
          foreignField: 'uuid',
          as: 'user',
          pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1, uuid: 1 } }]
        }
      },

      // Lookup category information
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [{ $project: { name: 1, displayName: 1, icon: 1, color: 1 } }]
        }
      },

      // Lookup shared users information
      {
        $lookup: {
          from: 'users',
          localField: 'sharedWith',
          foreignField: 'uuid',
          as: 'sharedUsers',
          pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1, uuid: 1 } }]
        }
      },

      // Lookup reviewer information
      {
        $lookup: {
          from: 'users',
          localField: 'reviewedBy',
          foreignField: 'uuid',
          as: 'reviewer',
          pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1, uuid: 1 } }]
        }
      },

      // Transform the data to match populate structure
      {
        $addFields: {
          userId: { $arrayElemAt: ['$user', 0] },
          categoryId: { $arrayElemAt: ['$category', 0] },
          reviewedBy: { $arrayElemAt: ['$reviewer', 0] },
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

    return this.transactionModel.aggregate(pipeline).exec();
  }
}
