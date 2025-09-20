import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BudgetsRepository } from '../budgets.repository';
import { CreateBudgetDto, UpdateBudgetDto, BudgetResponseDto } from '../dto';
import { BudgetDocument, BudgetPeriod, BudgetStatus } from '../schemas/budget.schema';
import { CategoriesService } from '../../categories/categories.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { Types } from 'mongoose';

@Injectable()
export class BudgetCommandService {
  constructor(
    private readonly budgetsRepository: BudgetsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly transactionsService: TransactionsService
  ) {}

}
