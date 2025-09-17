import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { BudgetsRepository } from '../budgets.repository';
import { BudgetQueryDto, BudgetResponseDto, BudgetSummaryDto } from '../dto';
import { BudgetDocument, BudgetStatus, BudgetPeriod } from '../schemas/budget.schema';
import { AccountsService } from '../../accounts/accounts.service';
import { CategoriesService } from '../../categories/categories.service';
import { PaginatedResult } from '../../expenses/expenses.repository';
import { Types } from 'mongoose';

@Injectable()
export class BudgetQueryService {
  constructor(
    private readonly budgetsRepository: BudgetsRepository,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService
  ) {}

  async findOne(id: string, userId: string): Promise<BudgetResponseDto> {
    const budgets = await this.budgetsRepository.findByIdWithAggregation(id);
    const budget = budgets[0];

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    // Check access permissions
    await this.validateBudgetAccess(budget, userId);

    return this.formatBudgetResponse(budget, true, true);
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
      mongoQuery.$or = [{ accountId: { $in: accountIds } }, { allowedUsers: userId }];
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

    const aggregationResult = await this.budgetsRepository.findWithAggregation(mongoQuery, sort, skip, limit);

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

  async getBudgetSummary(userId: string): Promise<BudgetSummaryDto> {
    // Get all accounts the user has access to
    const userAccounts = await this.accountsService.findByUser(userId);
    const accountIds = userAccounts.map(account => account._id);

    if (accountIds.length === 0) {
      // User has no accounts, return empty summary
      return {
        totalActiveBudgets: 0,
        totalBudgetAmount: 0,
        totalSpentAmount: 0,
        totalRemainingAmount: 0,
        overallProgress: 0,
        overBudgetCount: 0,
        activeAlertsCount: 0,
        budgetsByStatus: {} as Record<BudgetStatus, number>,
        budgetsByPeriod: {} as Record<BudgetPeriod, number>
      };
    }

    const budgets = await this.budgetsRepository.findByAccountIds(accountIds);

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

  async findTemplateById(templateId: string): Promise<BudgetDocument> {
    const template = await this.budgetsRepository.findTemplateById(templateId);

    if (!template) {
      throw new NotFoundException('Budget template not found');
    }

    return template;
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
        id: budget.createdBy.toString(),
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

  private calculateBudgetProgress(budget: BudgetDocument): any {
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
}
