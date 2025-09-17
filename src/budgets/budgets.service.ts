import { Injectable } from '@nestjs/common';
import { BudgetQueryDto, BudgetResponseDto, BudgetSummaryDto, CreateBudgetDto, UpdateBudgetDto } from './dto';
import { BudgetQueryService, BudgetCommandService } from './services';
import { PaginatedResult } from '../expenses/expenses.repository';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly budgetQueryService: BudgetQueryService,
    private readonly budgetCommandService: BudgetCommandService
  ) {}

  async create(createBudgetDto: CreateBudgetDto, userId: string): Promise<BudgetResponseDto> {
    return this.budgetCommandService.create(createBudgetDto, userId);
  }

  async findAll(query: BudgetQueryDto, userId: string): Promise<PaginatedResult<BudgetResponseDto>> {
    return this.budgetQueryService.findAll(query, userId);
  }

  async findOne(id: string, userId: string): Promise<BudgetResponseDto> {
    return this.budgetQueryService.findOne(id, userId);
  }

  async update(id: string, updateBudgetDto: UpdateBudgetDto, userId: string): Promise<BudgetResponseDto> {
    return this.budgetCommandService.update(id, updateBudgetDto, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    return this.budgetCommandService.remove(id, userId);
  }

  async getBudgetSummary(userId: string): Promise<BudgetSummaryDto> {
    return this.budgetQueryService.getBudgetSummary(userId);
  }

  async recalculateBudgetSpending(budgetId: string): Promise<void> {
    return this.budgetCommandService.recalculateBudgetSpending(budgetId);
  }

  async createFromTemplate(templateId: string, accountId: string, userId: string): Promise<BudgetResponseDto> {
    return this.budgetCommandService.createFromTemplate(templateId, accountId, userId);
  }

  async processAutoRenewals(): Promise<void> {
    return this.budgetCommandService.processAutoRenewals();
  }
}
