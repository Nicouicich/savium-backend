import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CategoriesService } from '../../categories/categories.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { BudgetsRepository } from '../budgets.repository';
import { BudgetResponseDto, CreateBudgetDto, UpdateBudgetDto } from '../dto';
import { BudgetDocument, BudgetPeriod, BudgetStatus } from '../schemas/budget.schema';

@Injectable()
export class BudgetCommandService {
  constructor(
    private readonly budgetsRepository: BudgetsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly transactionsService: TransactionsService
  ) {}
}
