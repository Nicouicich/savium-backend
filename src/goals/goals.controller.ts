import {BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards} from '@nestjs/common';
import {ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags} from '@nestjs/swagger';
import {GoalsService} from './goals.service';
import {CreateGoalDto, GoalQueryDto, GoalResponseDto, GoalSummaryDto, UpdateGoalDto} from './dto';
import {GoalPriority, GoalStatus, GoalType} from './schemas/goal.schema';
import {JwtAuthGuard} from '@common/guards/jwt-auth.guard';
import {CurrentUser} from '@common/decorators/current-user.decorator';
import {ApiResponseDecorator} from '@common/decorators/api-response.decorator';

@ApiTags('Goals')
@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new goal',
    description: 'Create a new goal with milestones and tracking'
  })
  @ApiResponseDecorator(GoalResponseDto, 201, 'Goal created successfully')
  async create(@Body() createGoalDto: CreateGoalDto, @CurrentUser() user: any): Promise<GoalResponseDto> {
    return this.goalsService.create(createGoalDto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all goals with filtering',
    description: 'Retrieve goals with various filters'
  })
  @ApiResponseDecorator([GoalResponseDto], 200, 'Goals retrieved successfully')
  async findAll(@Query() query: GoalQueryDto, @CurrentUser() user: any) {
    return this.goalsService.findAll(query, user.id);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get goal summary for account',
    description: 'Get aggregated goal statistics'
  })
  @ApiResponseDecorator(GoalSummaryDto, 200, 'Goal summary retrieved successfully')
  async getGoalSummary(@Query('accountId') accountId: string, @CurrentUser() user: any): Promise<GoalSummaryDto> {
    if (!accountId) throw new BadRequestException('Account ID is required');
    return this.goalsService.getGoalSummary(accountId, user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get goal by ID',
    description: 'Get detailed goal information'
  })
  @ApiResponseDecorator(GoalResponseDto, 200, 'Goal retrieved successfully')
  async findOne(@Param('id') id: string, @CurrentUser() user: any): Promise<GoalResponseDto> {
    return this.goalsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a goal',
    description: 'Update goal details and progress'
  })
  @ApiResponseDecorator(GoalResponseDto, 200, 'Goal updated successfully')
  async update(@Param('id') id: string, @Body() updateGoalDto: UpdateGoalDto, @CurrentUser() user: any): Promise<GoalResponseDto> {
    return this.goalsService.update(id, updateGoalDto, user.id);
  }

  @Patch(':id/progress')
  @ApiOperation({
    summary: 'Update goal progress',
    description: 'Add progress to goal'
  })
  @ApiResponseDecorator(GoalResponseDto, 200, 'Goal progress updated successfully')
  async updateProgress(@Param('id') id: string, @Body('amount') amount: number, @CurrentUser() user: any): Promise<GoalResponseDto> {
    if (amount === undefined || amount <= 0) {
      throw new BadRequestException('Progress amount must be positive');
    }
    return this.goalsService.updateProgress(id, amount, user.id);
  }

  @Patch(':id/archive')
  @ApiOperation({
    summary: 'Archive a goal',
    description: 'Archive (pause) a goal to temporarily stop tracking it'
  })
  @ApiParam({name: 'id', description: 'Goal ID'})
  @ApiResponseDecorator(GoalResponseDto, 200, 'Goal archived successfully')
  @ApiResponse({status: 404, description: 'Goal not found'})
  @ApiResponse({status: 400, description: 'Goal cannot be archived (already completed or archived)'})
  @ApiResponse({status: 403, description: 'Access denied to this goal'})
  async archiveGoal(@Param('id') id: string, @CurrentUser() user: any): Promise<GoalResponseDto> {
    return this.goalsService.archiveGoal(id, user.id);
  }

  @Patch(':id/unarchive')
  @ApiOperation({
    summary: 'Unarchive a goal',
    description: 'Unarchive (resume) a previously archived goal'
  })
  @ApiParam({name: 'id', description: 'Goal ID'})
  @ApiResponseDecorator(GoalResponseDto, 200, 'Goal unarchived successfully')
  @ApiResponse({status: 404, description: 'Goal not found'})
  @ApiResponse({status: 400, description: 'Goal is not archived'})
  @ApiResponse({status: 403, description: 'Access denied to this goal'})
  async unarchiveGoal(@Param('id') id: string, @CurrentUser() user: any): Promise<GoalResponseDto> {
    return this.goalsService.unarchiveGoal(id, user.id);
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Mark a goal as completed',
    description: 'Complete a goal and trigger completion celebrations/notifications'
  })
  @ApiParam({name: 'id', description: 'Goal ID'})
  @ApiResponseDecorator(GoalResponseDto, 200, 'Goal completed successfully')
  @ApiResponse({status: 404, description: 'Goal not found'})
  @ApiResponse({status: 400, description: 'Goal is already completed'})
  @ApiResponse({status: 403, description: 'Access denied to this goal'})
  async completeGoal(@Param('id') id: string, @CurrentUser() user: any): Promise<GoalResponseDto> {
    return this.goalsService.completeGoal(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({summary: 'Delete a goal', description: 'Soft delete a goal'})
  @ApiResponse({status: 200, description: 'Goal deleted successfully'})
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.goalsService.remove(id, user.id);
    return {message: 'Goal deleted successfully', deletedAt: new Date()};
  }
}
