import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '../transactions/transactions.repository';
import { CreateGoalDto, GoalQueryDto, GoalResponseDto, GoalSummaryDto, UpdateGoalDto } from './dto';
import { GoalCommandService, GoalQueryService } from './services';

@Injectable()
export class GoalsService {
  constructor(
    private readonly goalQueryService: GoalQueryService,
    private readonly goalCommandService: GoalCommandService
  ) {}
}
