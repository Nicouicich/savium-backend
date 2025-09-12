import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { BudgetQueryDto, BudgetResponseDto, BudgetSummaryDto, CreateBudgetDto, UpdateBudgetDto } from './dto';
import { BudgetPeriod, BudgetStatus } from './schemas/budget.schema';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponseDecorator } from '@common/decorators/api-response.decorator';

@ApiTags('Budgets')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new budget',
    description: 'Create a new budget with category allocations and alerts'
  })
  @ApiResponseDecorator(BudgetResponseDto, 201, 'Budget created successfully')
  async create(@Body() createBudgetDto: CreateBudgetDto, @CurrentUser() user: any): Promise<BudgetResponseDto> {
    return this.budgetsService.create(createBudgetDto, user.id);
  }

  @Post(':templateId/from-template')
  @ApiOperation({
    summary: 'Create budget from template',
    description: 'Create a new budget based on an existing template'
  })
  @ApiParam({ name: 'templateId', description: 'Template budget ID' })
  @ApiResponseDecorator(BudgetResponseDto, 201, 'Budget created from template successfully')
  async createFromTemplate(
    @Param('templateId') templateId: string,
    @Body('accountId') accountId: string,
    @CurrentUser() user: any
  ): Promise<BudgetResponseDto> {
    if (!accountId) {
      throw new BadRequestException('Account ID is required');
    }
    return this.budgetsService.createFromTemplate(templateId, accountId, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all budgets with filtering and pagination',
    description: 'Retrieve budgets with various filtering options and pagination'
  })
  @ApiQuery({
    name: 'accountId',
    required: false,
    type: String,
    description: 'Filter by account ID'
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: BudgetStatus,
    description: 'Filter by status'
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: BudgetPeriod,
    description: 'Filter by period'
  })
  @ApiQuery({
    name: 'isTemplate',
    required: false,
    type: Boolean,
    description: 'Filter templates only'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in name and description'
  })
  @ApiQuery({
    name: 'tags',
    required: false,
    type: String,
    description: 'Filter by tags (comma-separated)'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page'
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Sort field'
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order'
  })
  @ApiQuery({
    name: 'includeProgress',
    required: false,
    type: Boolean,
    description: 'Include progress data'
  })
  @ApiQuery({
    name: 'includeCategoryBreakdown',
    required: false,
    type: Boolean,
    description: 'Include category breakdown'
  })
  @ApiResponseDecorator([BudgetResponseDto], 200, 'Budgets retrieved successfully')
  async findAll(@Query() query: BudgetQueryDto, @CurrentUser() user: any) {
    return this.budgetsService.findAll(query, user.id);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get budget summary for an account',
    description: 'Get aggregated budget statistics and overview for an account'
  })
  @ApiQuery({
    name: 'accountId',
    required: true,
    type: String,
    description: 'Account ID'
  })
  @ApiResponseDecorator(BudgetSummaryDto, 200, 'Budget summary retrieved successfully')
  async getBudgetSummary(@Query('accountId') accountId: string, @CurrentUser() user: any): Promise<BudgetSummaryDto> {
    if (!accountId) {
      throw new BadRequestException('Account ID is required');
    }
    return this.budgetsService.getBudgetSummary(accountId, user.id);
  }

  @Get('templates')
  @ApiOperation({
    summary: 'Get budget templates',
    description: 'Retrieve available budget templates that can be used to create new budgets'
  })
  @ApiQuery({
    name: 'accountId',
    required: false,
    type: String,
    description: 'Filter by account ID'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in template names'
  })
  @ApiResponseDecorator([BudgetResponseDto], 200, 'Budget templates retrieved successfully')
  async getTemplates(@Query() query: BudgetQueryDto, @CurrentUser() user: any) {
    const templateQuery = {
      ...query,
      isTemplate: true,
      status: BudgetStatus.ACTIVE // Only show active templates
    };
    return this.budgetsService.findAll(templateQuery, user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get budget by ID',
    description: 'Get detailed information about a specific budget including progress and breakdowns'
  })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponseDecorator(BudgetResponseDto, 200, 'Budget retrieved successfully')
  async findOne(@Param('id') id: string, @CurrentUser() user: any): Promise<BudgetResponseDto> {
    return this.budgetsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a budget',
    description: 'Update budget details, allocations, and settings'
  })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponseDecorator(BudgetResponseDto, 200, 'Budget updated successfully')
  async update(@Param('id') id: string, @Body() updateBudgetDto: UpdateBudgetDto, @CurrentUser() user: any): Promise<BudgetResponseDto> {
    return this.budgetsService.update(id, updateBudgetDto, user.id);
  }

  @Patch(':id/recalculate')
  @ApiOperation({
    summary: 'Recalculate budget spending',
    description: 'Manually trigger recalculation of budget spending and progress'
  })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget recalculated successfully' })
  async recalculateBudget(@Param('id') id: string, @CurrentUser() user: any) {
    // Verify user has access to this budget first
    await this.budgetsService.findOne(id, user.id);

    await this.budgetsService.recalculateBudgetSpending(id);

    return {
      message: 'Budget spending recalculated successfully',
      budgetId: id,
      recalculatedAt: new Date()
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a budget',
    description: 'Soft delete a budget (marks as deleted but preserves data)'
  })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget deleted successfully' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.budgetsService.remove(id, user.id);
    return {
      message: 'Budget deleted successfully',
      deletedAt: new Date()
    };
  }

  @Post('process-renewals')
  @ApiOperation({
    summary: 'Process auto-renewals',
    description: 'Manually trigger processing of budget auto-renewals (typically run by scheduler)'
  })
  @ApiResponse({
    status: 200,
    description: 'Auto-renewals processed successfully'
  })
  async processAutoRenewals() {
    await this.budgetsService.processAutoRenewals();
    return {
      message: 'Auto-renewals processed successfully',
      processedAt: new Date()
    };
  }

  @Get('account/:accountId/active')
  @ApiOperation({
    summary: 'Get active budgets for account',
    description: 'Get all active budgets for a specific account with progress information'
  })
  @ApiParam({ name: 'accountId', description: 'Account ID' })
  @ApiResponseDecorator([BudgetResponseDto], 200, 'Active budgets retrieved successfully')
  async getActiveBudgets(@Param('accountId') accountId: string, @CurrentUser() user: any) {
    const query: BudgetQueryDto = {
      accountId,
      status: BudgetStatus.ACTIVE,
      includeProgress: true,
      includeCategoryBreakdown: true
    };
    return this.budgetsService.findAll(query, user.id);
  }

  @Get('account/:accountId/current')
  @ApiOperation({
    summary: 'Get current period budgets',
    description: 'Get budgets that are active for the current time period'
  })
  @ApiParam({ name: 'accountId', description: 'Account ID' })
  @ApiResponseDecorator([BudgetResponseDto], 200, 'Current period budgets retrieved successfully')
  async getCurrentPeriodBudgets(@Param('accountId') accountId: string, @CurrentUser() user: any) {
    const now = new Date();
    const query: BudgetQueryDto = {
      accountId,
      status: BudgetStatus.ACTIVE,
      startDate: now.toISOString().split('T')[0], // Today as start date filter
      includeProgress: true,
      includeCategoryBreakdown: true
    };
    return this.budgetsService.findAll(query, user.id);
  }

  @Get('periods/available')
  @ApiOperation({
    summary: 'Get available budget periods',
    description: 'Get list of available budget periods with descriptions'
  })
  @ApiResponse({
    status: 200,
    description: 'Available periods retrieved successfully'
  })
  async getAvailablePeriods() {
    return {
      periods: [
        {
          period: BudgetPeriod.WEEKLY,
          name: 'Weekly',
          description: 'Budget resets every week',
          durationDays: 7
        },
        {
          period: BudgetPeriod.MONTHLY,
          name: 'Monthly',
          description: 'Budget resets every month',
          durationDays: 30
        },
        {
          period: BudgetPeriod.QUARTERLY,
          name: 'Quarterly',
          description: 'Budget resets every 3 months',
          durationDays: 90
        },
        {
          period: BudgetPeriod.YEARLY,
          name: 'Yearly',
          description: 'Budget resets every year',
          durationDays: 365
        }
      ]
    };
  }

  @Get('status/available')
  @ApiOperation({
    summary: 'Get available budget statuses',
    description: 'Get list of available budget statuses with descriptions'
  })
  @ApiResponse({
    status: 200,
    description: 'Available statuses retrieved successfully'
  })
  async getAvailableStatuses() {
    return {
      statuses: [
        {
          status: BudgetStatus.ACTIVE,
          name: 'Active',
          description: 'Budget is currently active and tracking expenses'
        },
        {
          status: BudgetStatus.PAUSED,
          name: 'Paused',
          description: 'Budget is paused and not tracking expenses'
        },
        {
          status: BudgetStatus.EXCEEDED,
          name: 'Exceeded',
          description: 'Budget amount has been exceeded'
        },
        {
          status: BudgetStatus.COMPLETED,
          name: 'Completed',
          description: 'Budget period has ended'
        }
      ]
    };
  }
}
