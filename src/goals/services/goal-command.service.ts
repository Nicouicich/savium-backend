import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GoalsRepository } from '../goals.repository';
import { CreateGoalDto, UpdateGoalDto, GoalResponseDto } from '../dto';
import { GoalDocument, GoalStatus } from '../schemas/goal.schema';
import { AccountsService } from '../../accounts/accounts.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GoalCommandService {
  constructor(
    private readonly goalsRepository: GoalsRepository,
    private readonly accountsService: AccountsService
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

    // Create goal data
    const goalData = {
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
          currentAmount: 0,
          isCompleted: false,
          completedAt: undefined,
          order: milestone.order || 1
        })) || [],
      settings: {
        sendReminders: createGoalDto.settings?.sendReminders ?? true,
        reminderDaysBefore: createGoalDto.settings?.reminderDaysBefore ?? 7,
        trackAutomatically: createGoalDto.settings?.trackAutomatically ?? true,
        allowOverage: createGoalDto.settings?.allowOverage ?? false,
        showInDashboard: createGoalDto.settings?.showInDashboard ?? true,
        isPrivate: createGoalDto.settings?.isPrivate ?? false,
        linkedCategories: createGoalDto.settings?.linkedCategories || [],
        excludeCategories: createGoalDto.settings?.excludeCategories || []
      },
      metadata: {
        ...createGoalDto.metadata,
        source: 'manual',
        initialAmount: createGoalDto.currentAmount || 0
      }
    };

    const savedGoal = await this.goalsRepository.create(goalData);
    return this.formatGoalResponse(savedGoal, true, true);
  }

  async update(id: string, updateGoalDto: UpdateGoalDto, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalsRepository.findById(id);

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

    // Update the goal
    await this.goalsRepository.updateById(id, updateData);

    // Get updated goal with aggregation
    const updatedGoals = await this.goalsRepository.findByIdWithAggregation(id);
    const updatedGoal = updatedGoals[0];

    return this.formatGoalResponse(updatedGoal, true, true);
  }

  async remove(id: string, userId: string): Promise<void> {
    const goal = await this.goalsRepository.findById(id);

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    await this.validateGoalAccess(goal, userId);

    await this.goalsRepository.softDelete(id, userId);
  }

  async updateProgress(id: string, progressAmount: number, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalsRepository.findById(id);

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

    const updatedGoal = await this.goalsRepository.save(goal);
    return this.formatGoalResponse(updatedGoal, true, true);
  }

  async archiveGoal(id: string, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalsRepository.findById(id);

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
    const updatedGoal = await this.goalsRepository.save(goal);

    return this.formatGoalResponse(updatedGoal, true, true);
  }

  async unarchiveGoal(id: string, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalsRepository.findById(id);

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

    const updatedGoal = await this.goalsRepository.save(goal);

    return this.formatGoalResponse(updatedGoal, true, true);
  }

  async completeGoal(id: string, userId: string): Promise<GoalResponseDto> {
    const goal = await this.goalsRepository.findById(id);

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

    const updatedGoal = await this.goalsRepository.save(goal);

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

  private formatGoalResponse(goal: GoalDocument, includeProgress = false, includeMilestones = false): GoalResponseDto {
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

    return response;
  }
}
