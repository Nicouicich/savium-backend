import { ApiResponseDecorator } from '@common/decorators/api-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateGoalDto, GoalQueryDto, GoalResponseDto, GoalSummaryDto, UpdateGoalDto } from './dto';
import { GoalsService } from './goals.service';
import { GoalPriority, GoalStatus, GoalType } from './schemas/goal.schema';

@ApiTags('Goals')
@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}
}
