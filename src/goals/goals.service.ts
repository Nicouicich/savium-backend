import { Injectable } from '@nestjs/common';
import { CreateGoalDto, GoalQueryDto, GoalResponseDto, GoalSummaryDto, UpdateGoalDto } from './dto';
import { GoalQueryService, GoalCommandService } from './services';
import { PaginatedResult } from '../transactions/transactions.repository';

@Injectable()
export class GoalsService {
  constructor (
    private readonly goalQueryService: GoalQueryService,
    private readonly goalCommandService: GoalCommandService
  ) {}

}
