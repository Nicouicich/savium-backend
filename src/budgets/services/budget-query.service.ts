import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../../categories/categories.service';
import { BudgetsRepository } from '../budgets.repository';

@Injectable()
export class BudgetQueryService {
  constructor(
    private readonly budgetsRepository: BudgetsRepository,
    private readonly categoriesService: CategoriesService
  ) {}

  
}
