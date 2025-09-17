import { Injectable } from '@nestjs/common';
import { CreateGoalDto, GoalQueryDto, GoalResponseDto, GoalSummaryDto, UpdateGoalDto } from './dto';
import { GoalQueryService, GoalCommandService } from './services';
import { PaginatedResult } from '../expenses/expenses.repository';

@Injectable()
export class GoalsService {
  constructor(
    private readonly goalQueryService: GoalQueryService,
    private readonly goalCommandService: GoalCommandService
  ) {}

  async create(createGoalDto: CreateGoalDto, userId: string): Promise<GoalResponseDto> {
    return this.goalCommandService.create(createGoalDto, userId);
  }

  async findAll(query: GoalQueryDto, userId: string): Promise<PaginatedResult<GoalResponseDto>> {
    return this.goalQueryService.findAll(query, userId);
  }

  async findOne(id: string, userId: string): Promise<GoalResponseDto> {
    return this.goalQueryService.findOne(id, userId);
  }

  async update(id: string, updateGoalDto: UpdateGoalDto, userId: string): Promise<GoalResponseDto> {
    return this.goalCommandService.update(id, updateGoalDto, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    return this.goalCommandService.remove(id, userId);
  }

  async getGoalSummary(accountId: string, userId: string): Promise<GoalSummaryDto> {
    return this.goalQueryService.getGoalSummary(accountId, userId);
  }

  async updateProgress(id: string, progressAmount: number, userId: string): Promise<GoalResponseDto> {
    return this.goalCommandService.updateProgress(id, progressAmount, userId);
  }

  async archiveGoal(id: string, userId: string): Promise<GoalResponseDto> {
    return this.goalCommandService.archiveGoal(id, userId);
  }

  async unarchiveGoal(id: string, userId: string): Promise<GoalResponseDto> {
    return this.goalCommandService.unarchiveGoal(id, userId);
  }

  async completeGoal(id: string, userId: string): Promise<GoalResponseDto> {
    return this.goalCommandService.completeGoal(id, userId);
  }
}
