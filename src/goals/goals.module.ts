import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { GoalsRepository } from './goals.repository';
import { GoalQueryService, GoalCommandService } from './services';
import { Goal, GoalSchema } from './schemas/goal.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Goal.name, schema: GoalSchema }]), UsersModule],
  controllers: [GoalsController],
  providers: [GoalsRepository, GoalQueryService, GoalCommandService, GoalsService],
  exports: [GoalsService]
})
export class GoalsModule {}
