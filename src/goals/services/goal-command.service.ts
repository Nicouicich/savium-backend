import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GoalsRepository } from '../goals.repository';
import { CreateGoalDto, UpdateGoalDto, GoalResponseDto } from '../dto';
import { GoalDocument, GoalStatus } from '../schemas/goal.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GoalCommandService {
  constructor (
    private readonly goalsRepository: GoalsRepository,
  ) {}


}
