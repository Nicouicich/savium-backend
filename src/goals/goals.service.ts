import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { CreateGoalDto, GoalProgressDto, GoalQueryDto, GoalResponseDto, GoalSummaryDto, UpdateGoalDto } from './dto';
import { Goal, GoalDocument, GoalStatus, GoalType } from './schemas/goal.schema';
import { AccountsService } from '../accounts/accounts.service';
import { UsersService } from '../users/users.service';
import { PaginatedResult } from '../expenses/expenses.repository';

@Injectable()
export class GoalsService {
  constructor(
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
    private readonly accountsService: AccountsService,
    private readonly usersService: UsersService
  ) {}

  async create(createGoalDto: CreateGoalDto, userId: string): Promise<GoalResponseDto> {
    // Validate user has access to account
    const hasAccess = await this.accountsService.hasUserAccess(createGoalDto.accountId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this account');
    }

    // Validate target date is in the future
    if (createGoalDto.targetDate <= new Date()) {
      throw new BadRequestException('Target date must be in the future');
    }

    // Validate milestones if provided
    if (createGoalDto.milestones) {
      const sortedMilestones = createGoalDto.milestones.sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());

      for (let i = 0; i < sortedMilestones.length; i++) {
        const milestone = sortedMilestones[i];
        milestone.order = i + 1;

        if (milestone.targetDate >= createGoalDto.targetDate) {
          throw new BadRequestException('Milestone target dates must be before goal target date');
        }

        if (milestone.targetAmount >= createGoalDto.targetAmount) {
          throw new BadRequestException('Milestone amounts must be less than goal target amount');
        }
      }

      createGoalDto.milestones = sortedMilestones;
    }

    // Create goal
    const goal = new this.goalModel({
      ...createGoalDto,
      id: uuidv4(),
      accountId: createGoalDto.accountId,
      createdBy: userId,
      startDate: createGoalDto.startDate || new Date(),
      participants: createGoalDto.participants || [],
      linkedBudgetId: createGoalDto.linkedBudgetId,
      milestones:
        createGoalDto.milestones?.map(milestone => ({
          ...milestone,
          currentAmount: 0
        })) || [],
      metadata: {
        ...createGoalDto.metadata,
        source: 'manual',
        initialAmount: createGoalDto.currentAmount || 0
      }
    });

    const savedGoal = await goal.save();
    return this.formatGoalResponse(savedGoal, true, true);
  }

  async findAll(query: GoalQueryDto, userId: string): Promise<PaginatedResult<GoalResponseDto>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', includeProgress = false, includeMilestones = false, ...filters } = query;

    // Build query
    const mongoQuery: any = { isDeleted: false };

    // Account access filter
    if (filters.accountId) {
      const hasAccess = await this.accountsService.hasUserAccess(filters.accountId, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this account');
      }
      mongoQuery.accountId = filters.accountId;
    } else {
      // Get user's accessible accounts
      const userAccounts = await this.accountsService.findByUser(userId);
      const accountIds = userAccounts.map(account => account.id);
      mongoQuery.$or = [{ accountId: { $in: accountIds } }, { participants: userId }, { createdBy: userId }];
    }

    // Apply filters
    if (filters.type) mongoQuery.type = filters.type;
    if (filters.status) mongoQuery.status = filters.status;
    if (filters.priority) mongoQuery.priority = filters.priority;
    if (filters.recurrence) mongoQuery.recurrence = filters.recurrence;
    if (filters.isTemplate !== undefined) mongoQuery.isTemplate = filters.isTemplate;

    // Date filters
    if (filters.targetDateFrom || filters.targetDateTo) {
      mongoQuery.targetDate = {};
      if (filters.targetDateFrom) mongoQuery.targetDate.$gte = new Date(filters.targetDateFrom);
      if (filters.targetDateTo) mongoQuery.targetDate.$lte = new Date(filters.targetDateTo);
    }

    // Special filters
    if (filters.overdueOnly) {
      mongoQuery.status = GoalStatus.OVERDUE;
    }

    if (filters.nearCompletionOnly) {
      mongoQuery.$expr = {
        $gte: [{ $divide: ['$currentAmount', '$targetAmount'] }, 0.8]
      };
    }

    // Search
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      mongoQuery.$and = mongoQuery.$and || [];
      mongoQuery.$and.push({
        $or: [{ title: searchRegex }, { description: searchRegex }]
      });
    }

    if (filters.tags) {
      const tagArray = filters.tags.split(',').map(tag => tag.trim());
      mongoQuery['metadata.tags'] = { $in: tagArray };
    }

    // Execute query
    const skip = (page - 1) * limit;
    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const aggregationResult = await this.getGoalsWithAggregation(mongoQuery, sort, skip, limit);

    const goals = aggregationResult.data;
    const total = aggregationResult.total;

    const formattedGoals = await Promise.all(goals.map(goal => this.formatGoalResponse(goal, includeProgress, includeMilestones)));

    const totalPages = Math.ceil(total / limit);

    return {
      data: formattedGoals,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  async findOne(id: string, userId: string): Promise<GoalResponseDto> {
    // Use optimized aggregation pipeline to avoid N+1 queries (PERF-001)
    const goals = await this.getGoalByIdWithAggregation(id);
    const goal = goals[0];

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    await this.validateGoalAccess(goal, userId);
    return this.formatGoalResponse(goal, true, true);
  }

  async update(id: string, updateGoalDto: UpdateGoalDto, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalModel.findOne({ id: id, isDeleted: false }).exec();

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    await this.validateGoalAccess(goal, userId);

    // Handle progress updates
    if (updateGoalDto.addToProgress !== undefined) {
      updateGoalDto.currentAmount = goal.currentAmount + updateGoalDto.addToProgress;
      delete updateGoalDto.addToProgress;
    } else if (updateGoalDto.setProgress !== undefined) {
      updateGoalDto.currentAmount = updateGoalDto.setProgress;
      delete updateGoalDto.setProgress;
    }

    // Prepare update data
    const updateData: any = { ...updateGoalDto };
    if (updateGoalDto.participants) {
      updateData.participants = updateGoalDto.participants;
    }
    if (updateGoalDto.linkedBudgetId) {
      updateData.linkedBudgetId = updateGoalDto.linkedBudgetId;
    }

    // Update the goal first
    await this.goalModel.findOneAndUpdate({ id: id }, updateData, { new: true }).exec();

    // Use optimized aggregation pipeline to get updated goal (PERF-001)
    const updatedGoals = await this.getGoalByIdWithAggregation(id);
    const updatedGoal = updatedGoals[0];

    return this.formatGoalResponse(updatedGoal, true, true);
  }

  async remove(id: string, userId: string): Promise<void> {
    const goal = await this.goalModel.findOne({ id: id, isDeleted: false }).exec();

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    await this.validateGoalAccess(goal, userId);

    await this.goalModel
      .findOneAndUpdate(
        { id: id },
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId
        }
      )
      .exec();
  }

  async getGoalSummary(accountId: string, userId: string): Promise<GoalSummaryDto> {
    const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this account');
    }

    const goals = await this.goalModel
      .find({
        accountId: accountId,
        isDeleted: false
      })
      .exec();

    const activeGoals = goals.filter(g => g.status === GoalStatus.ACTIVE);
    const completedGoals = goals.filter(g => g.status === GoalStatus.COMPLETED);

    const summary: GoalSummaryDto = {
      totalActiveGoals: activeGoals.length,
      totalCompletedGoals: completedGoals.length,
      totalTargetAmount: activeGoals.reduce((sum, g) => sum + g.targetAmount, 0),
      totalProgressAmount: activeGoals.reduce((sum, g) => sum + g.currentAmount, 0),
      overallProgress: 0,
      overdueGoalsCount: goals.filter(g => g.status === GoalStatus.OVERDUE).length,
      nearCompletionCount: activeGoals.filter(g => g.currentAmount / g.targetAmount > 0.8).length,
      goalsByStatus: goals.reduce(
        (acc, goal) => {
          acc[goal.status] = (acc[goal.status] || 0) + 1;
          return acc;
        },
        {} as Record<GoalStatus, number>
      ),
      goalsByType: goals.reduce(
        (acc, goal) => {
          acc[goal.type] = (acc[goal.type] || 0) + 1;
          return acc;
        },
        {} as Record<GoalType, number>
      ),
      goalsByPriority: goals.reduce((acc, goal) => {
        acc[goal.priority] = (acc[goal.priority] || 0) + 1;
        return acc;
      }, {} as any)
    };

    if (summary.totalTargetAmount > 0) {
      summary.overallProgress = (summary.totalProgressAmount / summary.totalTargetAmount) * 100;
    }

    // Find next goal to complete
    const sortedActiveGoals = activeGoals.filter(g => g.remainingAmount > 0).sort((a, b) => a.remainingAmount - b.remainingAmount);

    if (sortedActiveGoals.length > 0) {
      const nextGoal = sortedActiveGoals[0];
      summary.nextToComplete = {
        id: (nextGoal as any)._id.toString(),
        title: nextGoal.title,
        remainingAmount: nextGoal.remainingAmount,
        targetDate: nextGoal.targetDate,
        daysRemaining: Math.ceil((nextGoal.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      };
    }

    return summary;
  }

  async updateProgress(id: string, progressAmount: number, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalModel.findOne({ id: id, isDeleted: false }).exec();

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    await this.validateGoalAccess(goal, userId);

    goal.currentAmount += progressAmount;

    // Update milestone progress
    goal.milestones.forEach(milestone => {
      if (milestone.targetAmount <= goal.currentAmount && !milestone.isCompleted) {
        milestone.currentAmount = milestone.targetAmount;
        milestone.isCompleted = true;
        milestone.completedAt = new Date();
      } else if (milestone.targetAmount <= goal.currentAmount) {
        milestone.currentAmount = milestone.targetAmount;
      } else {
        milestone.currentAmount = Math.min(milestone.targetAmount, goal.currentAmount);
      }
    });

    const updatedGoal = await goal.save();
    return this.formatGoalResponse(updatedGoal, true, true);
  }

  async archiveGoal(id: string, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalModel.findOne({ id: id, isDeleted: false }).exec();

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    await this.validateGoalAccess(goal, userId);

    if (goal.status === GoalStatus.COMPLETED) {
      throw new BadRequestException('Cannot archive a completed goal');
    }

    if (goal.status === GoalStatus.PAUSED) {
      throw new BadRequestException('Goal is already archived (paused)');
    }

    goal.status = GoalStatus.PAUSED;
    const updatedGoal = await goal.save();

    return this.formatGoalResponse(updatedGoal, true, true);
  }

  async unarchiveGoal(id: string, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalModel.findOne({ id: id, isDeleted: false }).exec();

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    await this.validateGoalAccess(goal, userId);

    if (goal.status !== GoalStatus.PAUSED) {
      throw new BadRequestException('Goal is not archived (paused)');
    }

    // Check if goal should be overdue based on current date
    const now = new Date();
    if (goal.targetDate < now && goal.currentAmount < goal.targetAmount) {
      goal.status = GoalStatus.OVERDUE;
    } else {
      goal.status = GoalStatus.ACTIVE;
    }

    const updatedGoal = await goal.save();

    return this.formatGoalResponse(updatedGoal, true, true);
  }

  async completeGoal(id: string, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalModel.findOne({ id: id, isDeleted: false }).exec();

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    await this.validateGoalAccess(goal, userId);

    if (goal.status === GoalStatus.COMPLETED) {
      throw new BadRequestException('Goal is already completed');
    }

    // Set current amount to target amount if not already there
    if (goal.currentAmount < goal.targetAmount) {
      goal.currentAmount = goal.targetAmount;
      goal.remainingAmount = 0;
    }

    goal.status = GoalStatus.COMPLETED;

    // Complete all milestones
    goal.milestones.forEach(milestone => {
      if (!milestone.isCompleted) {
        milestone.currentAmount = milestone.targetAmount;
        milestone.isCompleted = true;
        milestone.completedAt = new Date();
      }
    });

    const updatedGoal = await goal.save();

    return this.formatGoalResponse(updatedGoal, true, true);
  }

  private async validateGoalAccess(goal: GoalDocument, userId: string): Promise<void> {
    const hasAccountAccess = await this.accountsService.hasUserAccess(goal.accountId.toString(), userId);
    const isParticipant = goal.participants.some(p => p.toString() === userId);
    const isCreator = goal.createdBy.toString() === userId;

    if (!hasAccountAccess && !isParticipant && !isCreator) {
      throw new ForbiddenException('Access denied to this goal');
    }
  }

  private async formatGoalResponse(goal: GoalDocument, includeProgress = false, includeMilestones = false): Promise<GoalResponseDto> {
    const response: GoalResponseDto = {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      accountId: goal.accountId,
      accountName: (goal.accountId as any).name || 'Unknown Account',
      createdBy: {
        id: goal.createdBy,
        name:
          (goal.createdBy as any).firstName && (goal.createdBy as any).lastName
            ? `${(goal.createdBy as any).firstName} ${(goal.createdBy as any).lastName}`
            : 'Unknown User',
        email: (goal.createdBy as any).email || 'unknown@email.com'
      },
      type: goal.type,
      currency: goal.currency,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      remainingAmount: goal.remainingAmount,
      targetDate: goal.targetDate,
      startDate: goal.startDate,
      status: goal.status,
      priority: goal.priority,
      recurrence: goal.recurrence,
      recurringAmount: goal.recurringAmount,
      settings: goal.settings,
      participants: goal.participants.map((user: any) => ({
        id: user._id?.toString() || user.toString(),
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'Unknown User',
        email: user.email || 'unknown@email.com'
      })),
      linkedBudgetId: goal.linkedBudgetId?.toString(),
      isTemplate: goal.isTemplate,
      metadata: goal.metadata,
      createdAt: (goal as any).createdAt,
      updatedAt: (goal as any).updatedAt
    };

    if (includeMilestones && goal.milestones.length > 0) {
      response.milestones = goal.milestones.map(milestone => ({
        title: milestone.title,
        description: milestone.description,
        targetAmount: milestone.targetAmount,
        currentAmount: milestone.currentAmount,
        targetDate: milestone.targetDate,
        isCompleted: milestone.isCompleted,
        completedAt: milestone.completedAt,
        order: milestone.order,
        progressPercentage: milestone.targetAmount > 0 ? (milestone.currentAmount / milestone.targetAmount) * 100 : 0,
        daysRemaining: Math.max(0, Math.ceil((milestone.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
        isOverdue: milestone.targetDate < new Date() && !milestone.isCompleted
      }));
    }

    if (includeProgress) {
      response.progress = this.calculateGoalProgress(goal);
    }

    return response;
  }

  private calculateGoalProgress(goal: GoalDocument): GoalProgressDto {
    const now = new Date();
    const startDate = goal.startDate || (goal as any).createdAt;

    const totalDays = Math.ceil((goal.targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, Math.ceil((goal.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const progressPercentage = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

    const averageProgressPerDay = daysElapsed > 0 ? goal.currentAmount / daysElapsed : 0;
    const requiredDailyProgress = daysRemaining > 0 ? goal.remainingAmount / daysRemaining : 0;

    let healthStatus: 'excellent' | 'good' | 'warning' | 'danger' = 'excellent';
    if (progressPercentage >= 100) {
      healthStatus = 'excellent';
    } else if (progressPercentage >= 75) {
      healthStatus = 'good';
    } else if (progressPercentage >= 50 || daysRemaining > 30) {
      healthStatus = 'warning';
    } else {
      healthStatus = 'danger';
    }

    return {
      progressPercentage: Math.round(progressPercentage * 100) / 100,
      daysElapsed,
      totalDays,
      daysRemaining,
      averageProgressPerDay,
      requiredDailyProgress,
      onTrack: averageProgressPerDay >= requiredDailyProgress || progressPercentage >= 100,
      estimatedCompletion: goal.metadata.estimatedCompletion,
      isOverdue: goal.status === GoalStatus.OVERDUE,
      healthStatus
    };
  }

  /**
   * PERF-001: Optimized aggregation pipeline to avoid N+1 queries
   * Replaces multiple populate() calls with efficient $lookup operations
   */
  private async getGoalsWithAggregation(matchQuery: any, sort: any, skip: number, limit: number): Promise<{ data: any[]; total: number }> {
    const pipeline = [
      // Match stage - filter documents early
      { $match: matchQuery },

      // Lookup account information
      {
        $lookup: {
          from: 'accounts',
          localField: 'accountId',
          foreignField: 'id',
          as: 'account',
          pipeline: [{ $project: { name: 1, type: 1 } }]
        }
      },

      // Lookup creator information
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: 'id',
          as: 'creator',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Lookup participants information
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: 'id',
          as: 'participantsData',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Transform the data to match populate structure
      {
        $addFields: {
          accountId: { $arrayElemAt: ['$account', 0] },
          createdBy: { $arrayElemAt: ['$creator', 0] },
          participants: '$participantsData'
        }
      },

      // Remove temporary fields
      {
        $project: {
          account: 0,
          creator: 0,
          participantsData: 0
        }
      },

      // Sort the results
      { $sort: sort },

      // Facet for pagination and counting
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [result] = await this.goalModel.aggregate(pipeline).exec();

    return {
      data: result.data,
      total: result.totalCount[0]?.count || 0
    };
  }

  /**
   * PERF-001: Optimized aggregation pipeline for single goal lookup
   * Replaces multiple populate() calls with efficient $lookup operations
   */
  private async getGoalByIdWithAggregation(id: string): Promise<any[]> {
    // Validate UUID format (basic validation)
    if (!id || typeof id !== 'string' || id.length !== 36) {
      throw new BadRequestException('Invalid goal ID format');
    }

    const pipeline = [
      // Match specific goal
      {
        $match: {
          id: id,
          isDeleted: false
        }
      },

      // Lookup account information
      {
        $lookup: {
          from: 'accounts',
          localField: 'accountId',
          foreignField: 'id',
          as: 'account',
          pipeline: [{ $project: { name: 1, type: 1 } }]
        }
      },

      // Lookup creator information
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: 'id',
          as: 'creator',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Lookup participants information
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: 'id',
          as: 'participantsData',
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }]
        }
      },

      // Transform the data to match populate structure
      {
        $addFields: {
          accountId: { $arrayElemAt: ['$account', 0] },
          createdBy: { $arrayElemAt: ['$creator', 0] },
          participants: '$participantsData'
        }
      },

      // Remove temporary fields
      {
        $project: {
          account: 0,
          creator: 0,
          participantsData: 0
        }
      }
    ];

    return this.goalModel.aggregate(pipeline).exec();
  }
}
