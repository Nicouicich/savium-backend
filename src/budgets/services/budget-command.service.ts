import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BudgetsRepository } from '../budgets.repository';
import { CreateBudgetDto, UpdateBudgetDto, BudgetResponseDto } from '../dto';
import { BudgetDocument, BudgetPeriod, BudgetStatus } from '../schemas/budget.schema';
import { AccountsService } from '../../accounts/accounts.service';
import { CategoriesService } from '../../categories/categories.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { Types } from 'mongoose';

@Injectable()
export class BudgetCommandService {
  constructor(
    private readonly budgetsRepository: BudgetsRepository,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
    private readonly expensesService: ExpensesService
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

    // Check for overlapping budgets
    const overlappingBudgets = await this.budgetsRepository.findOverlappingBudgets(
      createBudgetDto.accountId,
      createBudgetDto.period,
      createBudgetDto.startDate,
      createBudgetDto.endDate
    );

    if (overlappingBudgets.length > 0) {
      throw new BadRequestException('A budget already exists for this period');
    }

    // Create budget data
    const budgetData = {
      ...createBudgetDto,
      accountId: new Types.ObjectId(createBudgetDto.accountId),
      createdBy: new Types.ObjectId(userId),
      allowedUsers: (createBudgetDto.allowedUsers || []).map(id => new Types.ObjectId(id)),
      categoryBudgets:
        createBudgetDto.categoryBudgets?.map(catBudget => ({
          ...catBudget,
          categoryId: new Types.ObjectId(catBudget.categoryId),
          remainingAmount: catBudget.allocatedAmount,
          spentAmount: 0,
          trackExpenses: catBudget.trackExpenses ?? true,
          alerts:
            catBudget.alerts?.map(alert => ({
              ...alert,
              enabled: alert.enabled ?? true,
              triggered: false,
              triggeredAt: undefined
            })) || []
        })) || [],
      spentAmount: 0,
      remainingAmount: createBudgetDto.totalAmount,
      globalAlerts:
        createBudgetDto.globalAlerts?.map(alert => ({
          ...alert,
          enabled: alert.enabled ?? true,
          triggered: false,
          triggeredAt: undefined
        })) || [],
      metadata: {
        ...createBudgetDto.metadata,
        source: 'manual',
        trackingEnabled: true,
        notificationsEnabled: true
      }
    };

    const savedBudget = await this.budgetsRepository.create(budgetData);

    // Calculate initial spending if budget period has already started
    if (createBudgetDto.startDate <= new Date()) {
      await this.recalculateBudgetSpending((savedBudget as any)._id.toString());
    }

    // Return the basic budget data, let the service layer handle full formatting
    const budgets = await this.budgetsRepository.findByIdWithAggregation((savedBudget as any)._id.toString());
    return this.formatBudgetResponse(budgets[0], true, true);
  }

  async update(id: string, updateBudgetDto: UpdateBudgetDto, userId: string): Promise<BudgetResponseDto> {
    const budget = await this.budgetsRepository.findById(id);

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

    // Update the budget
    await this.budgetsRepository.updateById(id, updateData);

    // Recalculate spending if budget parameters changed
    if (updateBudgetDto.categoryBudgets || updateBudgetDto.totalAmount) {
      await this.recalculateBudgetSpending(id);
    }

    // Return the updated budget data
    const updatedBudgets = await this.budgetsRepository.findByIdWithAggregation(id);
    return this.formatBudgetResponse(updatedBudgets[0], true, true);
  }

  async remove(id: string, userId: string): Promise<void> {
    const budget = await this.budgetsRepository.findById(id);

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    await this.validateBudgetAccess(budget, userId);

    await this.budgetsRepository.softDelete(id, userId);
  }

  async createFromTemplate(templateId: string, accountId: string, userId: string): Promise<BudgetResponseDto> {
    const template = await this.budgetsRepository.findTemplateById(templateId);

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
    const budgetsToRenew = await this.budgetsRepository.findBudgetsForAutoRenewal();

    for (const budget of budgetsToRenew) {
      try {
        const { startDate, endDate } = this.calculatePeriodDates(budget.period, budget.endDate);

        const newBudgetData = {
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
        };

        await this.budgetsRepository.create(newBudgetData);
      } catch (error) {
        console.error(`Error auto-renewing budget ${budget._id}:`, error);
      }
    }
  }

  async recalculateBudgetSpending(budgetId: string): Promise<void> {
    const budget = await this.budgetsRepository.findById(budgetId);
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

    await this.budgetsRepository.save(budget);
  }

  private async validateBudgetAccess(budget: BudgetDocument, userId: string): Promise<void> {
    const hasAccountAccess = await this.accountsService.hasUserAccess(budget.accountId.toString(), userId);

    const isAllowedUser = budget.allowedUsers.some(allowedUserId => allowedUserId.toString() === userId);

    if (!hasAccountAccess && !isAllowedUser) {
      throw new ForbiddenException('Access denied to this budget');
    }
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

    return response;
  }
}
