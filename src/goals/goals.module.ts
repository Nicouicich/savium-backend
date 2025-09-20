import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { GoalsController } from './goals.controller';
import { GoalsRepository } from './goals.repository';
import { GoalsService } from './goals.service';
import { Goal, GoalSchema } from './schemas/goal.schema';
import { GoalCommandService, GoalQueryService } from './services';

@Module({
  imports: [MongooseModule.forFeature([{ name: Goal.name, schema: GoalSchema }]), UsersModule],
  controllers: [GoalsController],
  providers: [GoalsRepository, GoalQueryService, GoalCommandService, GoalsService],
  exports: [GoalsService]
})
export class GoalsModule {}
