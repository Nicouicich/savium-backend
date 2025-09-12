import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BudgetProgressDto, BudgetQueryDto, BudgetResponseDto, BudgetSummaryDto, CategoryBudgetResponseDto, CreateBudgetDto, UpdateBudgetDto } from './dto';
import { Budget, BudgetDocument, BudgetPeriod, BudgetStatus } from './schemas/budget.schema';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { ExpensesService } from '../expenses/expenses.service';
import { UsersService } from '../users/users.service';
import { PaginatedResult } from '../expenses/expenses.repository';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private budgetModel: Model<BudgetDocument>,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
    private readonly expensesService: ExpensesService,
    private readonly usersService: UsersService
  ) {}

  async create(createBudgetDto: CreateBudgetDto, userId: string): Promise<BudgetResponseDto> {
    // Validate user has access to account
    const hasAccess = await this.accountsService.hasUserAccess(createBudgetDto.accountId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this account');
    }

    // Validate date range
    if (createBudgetDto.endDate <= createBudgetDto.startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate category budgets don't exceed total
    if (createBudgetDto.categoryBudgets) {
      const totalCategoryAmount = createBudgetDto.categoryBudgets.reduce((sum, cat) => sum + cat.allocatedAmount, 0);

      if (totalCategoryAmount > createBudgetDto.totalAmount) {
        throw new BadRequestException('Category budget allocation exceeds total budget amount');
      }

      // Validate categories exist
      for (const categoryBudget of createBudgetDto.categoryBudgets) {
        const category = await this.categoriesService.findById(categoryBudget.categoryId);
        if (!category) {
          throw new NotFoundException(`Category ${categoryBudget.categoryId} not found`);
        }
      }
    }

    // Check for overlapping budgets for same period and account
    const overlappingBudgets = await this.budgetModel.find({
      accountId: new Types.ObjectId(createBudgetDto.accountId),
      period: createBudgetDto.period,
      isDeleted: false,
      $or: [
        {
          startDate: { $lte: createBudgetDto.endDate },
          endDate: { $gte: createBudgetDto.startDate }
        }
      ]
    });

    if (overlappingBudgets.length > 0) {
      throw new BadRequestException('A budget already exists for this period');
    }

    // Create budget
    const budget = new this.budgetModel({
      ...createBudgetDto,
      accountId: new Types.ObjectId(createBudgetDto.accountId),
      createdBy: new Types.ObjectId(userId),
      categoryBudgets:
        createBudgetDto.categoryBudgets?.map(catBudget => ({
          ...catBudget,
          categoryId: new Types.ObjectId(catBudget.categoryId),
          remainingAmount: catBudget.allocatedAmount,
          spentAmount: 0
        })) || [],
      spentAmount: 0,
      remainingAmount: createBudgetDto.totalAmount,
      metadata: {
        ...createBudgetDto.metadata,
        source: 'manual',
        trackingEnabled: true,
        notificationsEnabled: true
      }
    });

    const savedBudget = await budget.save();

    // Calculate initial spending if budget period has already started
    if (createBudgetDto.startDate <= new Date()) {
      await this.recalculateBudgetSpending((savedBudget as any)._id.toString());
    }

    return this.formatBudgetResponse(savedBudget, true, true);
  }

  async findAll(query: BudgetQueryDto, userId: string): Promise<PaginatedResult<BudgetResponseDto>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', includeProgress = false, includeCategoryBreakdown = false, ...filters } = query;

    // Build query
    const mongoQuery: any = { isDeleted: false };

    // If user doesn't have admin access, filter by accessible accounts
    if (filters.accountId) {
      const hasAccess = await this.accountsService.hasUserAccess(filters.accountId, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this account');
      }
      mongoQuery.accountId = new Types.ObjectId(filters.accountId);
    } else {
      // Get user's accessible accounts
      const userAccounts = await this.accountsService.findByUser(userId);
      const accountIds = userAccounts.map(account => account._id);
      mongoQuery.$or = [{ accountId: { $in: accountIds } }, { allowedUsers: new Types.ObjectId(userId) }];
    }

    // Apply other filters
    if (filters.status) {
      mongoQuery.status = filters.status;
    }
    if (filters.period) {
      mongoQuery.period = filters.period;
    }
    if (filters.startDate || filters.endDate) {
      mongoQuery.startDate = {};
      if (filters.startDate) mongoQuery.startDate.$gte = new Date(filters.startDate);
      if (filters.endDate) mongoQuery.endDate = { $lte: new Date(filters.endDate) };
    }
    if (filters.isTemplate !== undefined) {
      mongoQuery.isTemplate = filters.isTemplate;
    }
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      mongoQuery.$or = mongoQuery.$or
        ? [...mongoQuery.$or, { name: searchRegex }, { description: searchRegex }]
        : [{ name: searchRegex }, { description: searchRegex }];
    }
    if (filters.tags) {
      const tagArray = filters.tags.split(',').map(tag => tag.trim());
      mongoQuery['metadata.tags'] = { $in: tagArray };
    }

    // Execute query
    const skip = (page - 1) * limit;
    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const aggregationResult = await this.getBudgetsWithAggregation(mongoQuery, sort, skip, limit);

    const budgets = aggregationResult.data;
    const total = aggregationResult.total;

    const formattedBudgets = await Promise.all(budgets.map(budget => this.formatBudgetResponse(budget, includeProgress, includeCategoryBreakdown)));

    const totalPages = Math.ceil(total / limit);

    return {
      data: formattedBudgets,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  async findOne(id: string, userId: string): Promise<BudgetResponseDto> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const budgets = await this.getBudgetByIdWithAggregation(id);
    const budget = budgets[0];

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    // Check access permissions
    await this.validateBudgetAccess(budget, userId);

    return this.formatBudgetResponse(budget, true, true);
  }

  async update(id: string, updateBudgetDto: UpdateBudgetDto, userId: string): Promise<BudgetResponseDto> {
    const budget = await this.budgetModel.findOne({ _id: id, isDeleted: false }).exec();

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    await this.validateBudgetAccess(budget, userId);

    // Validate category budgets if being updated
    if (updateBudgetDto.categoryBudgets) {
      const totalAmount = updateBudgetDto.totalAmount || budget.totalAmount;
      const totalCategoryAmount = updateBudgetDto.categoryBudgets.reduce((sum, cat) => sum + cat.allocatedAmount, 0);

      if (totalCategoryAmount > totalAmount) {
        throw new BadRequestException('Category budget allocation exceeds total budget amount');
      }

      // Validate categories exist
      for (const categoryBudget of updateBudgetDto.categoryBudgets) {
        const category = await this.categoriesService.findById(categoryBudget.categoryId);
        if (!category) {
          throw new NotFoundException(`Category ${categoryBudget.categoryId} not found`);
        }
      }
    }

    // Prepare update data
    const updateData: any = { ...updateBudgetDto };
    if (updateBudgetDto.categoryBudgets) {
      updateData.categoryBudgets = updateBudgetDto.categoryBudgets.map(catBudget => ({
        ...catBudget,
        categoryId: new Types.ObjectId(catBudget.categoryId)
      }));
    }

    // Update the budget first
    await this.budgetModel.findByIdAndUpdate(id, updateData, { new: true }).exec();

    // Use optimized aggregation pipeline to get updated budget (PERF-001)
    const updatedBudgets = await this.getBudgetByIdWithAggregation(id);
    const updatedBudget = updatedBudgets[0];

    // Recalculate spending if budget parameters changed
    if (updateBudgetDto.categoryBudgets || updateBudgetDto.totalAmount) {
      await this.recalculateBudgetSpending(id);
    }

    return this.formatBudgetResponse(updatedBudget, true, true);
  }

  async remove(id: string, userId: string): Promise<void> {
    const budget = await this.budgetModel.findOne({ _id: id, isDeleted: false }).exec();

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    await this.validateBudgetAccess(budget, userId);

    await this.budgetModel
      .findByIdAndUpdate(id, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: new Types.ObjectId(userId)
      })
      .exec();
  }

  async getBudgetSummary(accountId: string, userId: string): Promise<BudgetSummaryDto> {
    const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this account');
    }

    const budgets = await this.budgetModel
      .find({
        accountId: new Types.ObjectId(accountId),
        isDeleted: false
      })
      .exec();

    const activeBudgets = budgets.filter(b => b.status === BudgetStatus.ACTIVE);

    const summary: BudgetSummaryDto = {
      totalActiveBudgets: activeBudgets.length,
      totalBudgetAmount: activeBudgets.reduce((sum, b) => sum + b.totalAmount, 0),
      totalSpentAmount: activeBudgets.reduce((sum, b) => sum + b.spentAmount, 0),
      totalRemainingAmount: activeBudgets.reduce((sum, b) => sum + b.remainingAmount, 0),
      overallProgress: 0,
      overBudgetCount: activeBudgets.filter(b => b.spentAmount > b.totalAmount).length,
      activeAlertsCount: activeBudgets.reduce((sum, b) => sum + b.globalAlerts.filter(alert => alert.enabled && alert.triggered).length, 0),
      budgetsByStatus: budgets.reduce(
        (acc, budget) => {
          acc[budget.status] = (acc[budget.status] || 0) + 1;
          return acc;
        },
        {} as Record<BudgetStatus, number>
      ),
      budgetsByPeriod: budgets.reduce(
        (acc, budget) => {
          acc[budget.period] = (acc[budget.period] || 0) + 1;
          return acc;
        },
        {} as Record<BudgetPeriod, number>
      )
    };

    if (summary.totalBudgetAmount > 0) {
      summary.overallProgress = (summary.totalSpentAmount / summary.totalBudgetAmount) * 100;
    }

    return summary;
  }

  async recalculateBudgetSpending(budgetId: string): Promise<void> {
    const budget = await this.budgetModel.findById(budgetId).exec();
    if (!budget) return;

    // Get expenses for this budget period
    const expenses = await this.expensesService.findByAccount(budget.accountId.toString(), {
      startDate: budget.startDate,
      endDate: budget.endDate,
      limit: 10000 // Get all expenses for this period
    });

    // Calculate total spending
    const totalSpent = expenses.data.reduce((sum, expense) => sum + expense.amount, 0);

    // Calculate category spending
    const categorySpending = new Map<string, number>();
    expenses.data.forEach(expense => {
      const categoryId = expense.categoryId.toString();
      categorySpending.set(categoryId, (categorySpending.get(categoryId) || 0) + expense.amount);
    });

    // Update category budgets
    budget.categoryBudgets.forEach(categoryBudget => {
      const categoryId = categoryBudget.categoryId.toString();
      const spent = categorySpending.get(categoryId) || 0;
      categoryBudget.spentAmount = spent;
      categoryBudget.remainingAmount = Math.max(0, categoryBudget.allocatedAmount - spent);
    });

    // Update total budget amounts
    budget.spentAmount = totalSpent;
    budget.remainingAmount = Math.max(0, budget.totalAmount - totalSpent);

    // Check and trigger alerts
    await this.checkAndTriggerAlerts(budget);

    // Update status based on spending
    if (totalSpent >= budget.totalAmount) {
      budget.status = BudgetStatus.EXCEEDED;
    } else if (budget.endDate < new Date()) {
      budget.status = BudgetStatus.COMPLETED;
    }

    // Update metadata
    budget.metadata.lastRecalculated = new Date();

    await budget.save();
  }

  async createFromTemplate(templateId: string, accountId: string, userId: string): Promise<BudgetResponseDto> {
    const template = await this.budgetModel
      .findOne({
        _id: templateId,
        isTemplate: true,
        isDeleted: false
      })
      .exec();

    if (!template) {
      throw new NotFoundException('Budget template not found');
    }

    const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this account');
    }

    // Calculate new budget period dates
    const now = new Date();
    const { startDate, endDate } = this.calculatePeriodDates(template.period, now);

    const newBudgetData: CreateBudgetDto = {
      name: `${template.name} (from template)`,
      description: template.description,
      accountId,
      currency: template.currency,
      totalAmount: template.totalAmount,
      period: template.period,
      startDate,
      endDate,
      categoryBudgets: template.categoryBudgets.map(catBudget => ({
        categoryId: catBudget.categoryId.toString(),
        allocatedAmount: catBudget.allocatedAmount,
        alerts: catBudget.alerts.map(alert => ({
          type: alert.type,
          threshold: alert.threshold,
          enabled: alert.enabled,
          message: alert.message
        })),
        trackExpenses: catBudget.trackExpenses
      })),
      globalAlerts: template.globalAlerts.map(alert => ({
        type: alert.type,
        threshold: alert.threshold,
        enabled: alert.enabled,
        message: alert.message
      })),
      autoRenew: template.autoRenew,
      metadata: {
        ...template.metadata,
        source: 'template'
      }
    };

    return this.create(newBudgetData, userId);
  }

  async processAutoRenewals(): Promise<void> {
    // Find budgets that need to be auto-renewed
    const budgetsToRenew = await this.budgetModel
      .find({
        autoRenew: true,
        status: BudgetStatus.COMPLETED,
        endDate: { $lt: new Date() },
        isDeleted: false,
        renewedFromId: { $exists: false } // Haven't been renewed yet
      })
      .exec();

    for (const budget of budgetsToRenew) {
      try {
        const { startDate, endDate } = this.calculatePeriodDates(budget.period, budget.endDate);

        const newBudget = new this.budgetModel({
          ...budget.toObject(),
          _id: undefined,
          name: `${budget.name} (Auto-renewed)`,
          startDate,
          endDate,
          spentAmount: 0,
          remainingAmount: budget.totalAmount,
          status: BudgetStatus.ACTIVE,
          renewedFromId: budget._id,
          categoryBudgets: budget.categoryBudgets.map(catBudget => ({
            ...catBudget,
            spentAmount: 0,
            remainingAmount: catBudget.allocatedAmount,
            alerts: catBudget.alerts.map(alert => ({
              ...alert,
              triggered: false,
              triggeredAt: undefined
            }))
          })),
          globalAlerts: budget.globalAlerts.map(alert => ({
            ...alert,
            triggered: false,
            triggeredAt: undefined
          })),
          metadata: {
            ...budget.metadata,
            source: 'auto_renewed'
          }
        });

        await newBudget.save();
      } catch (error) {
        console.error(`Error auto-renewing budget ${budget._id}:`, error);
      }
    }
  }

  private async validateBudgetAccess(budget: BudgetDocument, userId: string): Promise<void> {
    const hasAccountAccess = await this.accountsService.hasUserAccess(budget.accountId.toString(), userId);

    const isAllowedUser = budget.allowedUsers.some(allowedUserId => allowedUserId.toString() === userId);

    if (!hasAccountAccess && !isAllowedUser) {
      throw new ForbiddenException('Access denied to this budget');
    }
  }

  private async formatBudgetResponse(budget: BudgetDocument, includeProgress = false, includeCategoryBreakdown = false): Promise<BudgetResponseDto> {
    const response: BudgetResponseDto = {
      id: (budget as any)._id.toString(),
      name: budget.name,
      description: budget.description,
      accountId: budget.accountId._id?.toString() || budget.accountId.toString(),
      accountName: (budget.accountId as any).name || 'Unknown Account',
      createdBy: {
        id: budget.createdBy._id?.toString() || budget.createdBy.toString(),
        name:
          (budget.createdBy as any).firstName && (budget.createdBy as any).lastName
            ? `${(budget.createdBy as any).firstName} ${(budget.createdBy as any).lastName}`
            : 'Unknown User',
        email: (budget.createdBy as any).email || 'unknown@email.com'
      },
      currency: budget.currency,
      totalAmount: budget.totalAmount,
      spentAmount: budget.spentAmount,
      remainingAmount: budget.remainingAmount,
      period: budget.period,
      startDate: budget.startDate,
      endDate: budget.endDate,
      status: budget.status,
      autoRenew: budget.autoRenew,
      renewedFromId: budget.renewedFromId?.toString(),
      isTemplate: budget.isTemplate,
      globalAlerts: budget.globalAlerts,
      allowedUsers: budget.allowedUsers.map((user: any) => ({
        id: user._id?.toString() || user.toString(),
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'Unknown User',
        email: user.email || 'unknown@email.com'
      })),
      metadata: budget.metadata,
      createdAt: (budget as any).createdAt,
      updatedAt: (budget as any).updatedAt
    };

    if (includeCategoryBreakdown && budget.categoryBudgets.length > 0) {
      response.categoryBudgets = await Promise.all(
        budget.categoryBudgets.map(async catBudget => {
          const category = await this.categoriesService.findById(catBudget.categoryId.toString());
          const progressPercentage = catBudget.allocatedAmount > 0 ? (catBudget.spentAmount / catBudget.allocatedAmount) * 100 : 0;

          return {
            categoryId: catBudget.categoryId.toString(),
            categoryName: category?.displayName || 'Unknown Category',
            categoryIcon: category?.icon || '❓',
            categoryColor: category?.color || '#666666',
            allocatedAmount: catBudget.allocatedAmount,
            spentAmount: catBudget.spentAmount,
            remainingAmount: catBudget.remainingAmount,
            progressPercentage: Math.round(progressPercentage * 100) / 100,
            isOverBudget: catBudget.spentAmount > catBudget.allocatedAmount,
            alerts: catBudget.alerts,
            trackExpenses: catBudget.trackExpenses
          };
        })
      );
    }

    if (includeProgress) {
      response.progress = this.calculateBudgetProgress(budget);
    }

    return response;
  }

  private calculateBudgetProgress(budget: BudgetDocument): BudgetProgressDto {
    const now = new Date();
    const totalDays = Math.ceil((budget.endDate.getTime() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.min(totalDays, Math.ceil((now.getTime() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const overallProgress = budget.totalAmount > 0 ? (budget.spentAmount / budget.totalAmount) * 100 : 0;

    const expectedProgress = daysElapsed > 0 ? (daysElapsed / totalDays) * 100 : 0;
    const expectedSpending = (expectedProgress / 100) * budget.totalAmount;
    const spendingVariance = budget.spentAmount - expectedSpending;

    const projectedSpending = daysElapsed > 0 ? (budget.spentAmount / daysElapsed) * totalDays : 0;

    const averageDailySpending = daysElapsed > 0 ? budget.spentAmount / daysElapsed : 0;

    let healthStatus: 'excellent' | 'good' | 'warning' | 'danger' = 'excellent';
    if (overallProgress > 100) {
      healthStatus = 'danger';
    } else if (overallProgress > 90) {
      healthStatus = 'warning';
    } else if (overallProgress > 75) {
      healthStatus = 'good';
    }

    return {
      overallProgress: Math.round(overallProgress * 100) / 100,
      daysElapsed: Math.max(0, daysElapsed),
      totalDays,
      expectedSpending,
      spendingVariance,
      onTrack: Math.abs(spendingVariance) <= budget.totalAmount * 0.1, // Within 10% variance
      projectedSpending,
      averageDailySpending,
      healthStatus
    };
  }

  private async checkAndTriggerAlerts(budget: BudgetDocument): Promise<void> {
    // Check global alerts
    for (const alert of budget.globalAlerts) {
      if (!alert.enabled || alert.triggered) continue;

      let shouldTrigger = false;
      switch (alert.type) {
        case 'percentage':
          const percentageSpent = (budget.spentAmount / budget.totalAmount) * 100;
          shouldTrigger = percentageSpent >= alert.threshold;
          break;
        case 'amount':
          shouldTrigger = budget.spentAmount >= alert.threshold;
          break;
        case 'remaining':
          shouldTrigger = budget.remainingAmount <= alert.threshold;
          break;
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = new Date();
        // Here you would typically send a notification
      }
    }

    // Check category alerts
    for (const categoryBudget of budget.categoryBudgets) {
      for (const alert of categoryBudget.alerts) {
        if (!alert.enabled || alert.triggered) continue;

        let shouldTrigger = false;
        switch (alert.type) {
          case 'percentage':
            const percentageSpent = (categoryBudget.spentAmount / categoryBudget.allocatedAmount) * 100;
            shouldTrigger = percentageSpent >= alert.threshold;
            break;
          case 'amount':
            shouldTrigger = categoryBudget.spentAmount >= alert.threshold;
            break;
          case 'remaining':
            shouldTrigger = categoryBudget.remainingAmount <= alert.threshold;
            break;
        }

        if (shouldTrigger) {
          alert.triggered = true;
          alert.triggeredAt = new Date();
          // Here you would typically send a notification
        }
      }
    }
  }

  private calculatePeriodDates(period: BudgetPeriod, fromDate: Date): { startDate: Date; endDate: Date } {
    const startDate = new Date(fromDate);
    const endDate = new Date(fromDate);

    switch (period) {
      case BudgetPeriod.WEEKLY:
        endDate.setDate(startDate.getDate() + 7);
        break;
      case BudgetPeriod.MONTHLY:
        endDate.setMonth(startDate.getMonth() + 1);
        break;
      case BudgetPeriod.QUARTERLY:
        endDate.setMonth(startDate.getMonth() + 3);
        break;
      case BudgetPeriod.YEARLY:
        endDate.setFullYear(startDate.getFullYear() + 1);
        break;
    }

    endDate.setDate(endDate.getDate() - 1); // End date is inclusive
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  /**
   * PERF-001: Optimized aggregation pipeline to avoid N+1 queries
   * Replaces multiple populate() calls with efficient $lookup operations
   */
  private async getBudgetsWithAggregation(matchQuery: any, sort: any, skip: number, limit: number): Promise<{ data: any[]; total: number }> {
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

  /**
   * PERF-001: Optimized aggregation pipeline for single budget lookup
   * Replaces multiple populate() calls with efficient $lookup operations
   */
  private async getBudgetByIdWithAggregation(id: string): Promise<any[]> {
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
}
