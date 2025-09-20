import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Goal, GoalDocument } from './schemas/goal.schema';

@Injectable()
export class GoalsRepository {
  constructor(@InjectModel(Goal.name) private goalModel: Model<GoalDocument>) {}
}
