import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateGoalDto, GoalResponseDto, UpdateGoalDto } from '../dto';
import { GoalsRepository } from '../goals.repository';
import { GoalDocument, GoalStatus } from '../schemas/goal.schema';

@Injectable()
export class GoalCommandService {
  constructor(private readonly goalsRepository: GoalsRepository) {}
}
