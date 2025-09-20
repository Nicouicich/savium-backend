import { Injectable } from '@nestjs/common';
import { GoalsRepository } from '../goals.repository';

@Injectable()
export class GoalQueryService {
  constructor(private readonly goalsRepository: GoalsRepository) {}
}
