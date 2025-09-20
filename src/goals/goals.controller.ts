import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GoalsService } from './goals.service';
import { CreateGoalDto, GoalQueryDto, GoalResponseDto, GoalSummaryDto, UpdateGoalDto } from './dto';
import { GoalPriority, GoalStatus, GoalType } from './schemas/goal.schema';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponseDecorator } from '@common/decorators/api-response.decorator';

@ApiTags('Goals')
@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor (private readonly goalsService: GoalsService) {}

}
