import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Account, AccountDocument } from '../schemas/account.schema';
import { CoupleSettings, CoupleSettingsDocument } from '../schemas/couple-settings.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Expense, ExpenseDocument } from '../../expenses/schemas/expense.schema';

import { UpdateCoupleSettingsDto, CoupleSettingsResponseDto, AcceptCoupleInvitationDto, CoupleStatsDto } from '../dto/couple-settings.dto';

import {
  CoupleFinancialModel,
  CoupleExpenseType,
  CoupleReactionType,
  DEFAULT_COUPLE_PREFERENCES,
  COUPLE_PREMIUM_FEATURES
} from '@common/constants/couple-types';

import { AccountType } from '@common/constants/account-types';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-codes';

@Injectable()
export class CoupleService {
  constructor(
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
    @InjectModel(CoupleSettings.name)
    private readonly coupleSettingsModel: Model<CoupleSettingsDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>
  ) {}

  /**
   * Type predicate to check if coupleSettingsId is populated
   */
  private isPopulatedCoupleSettings(coupleSettingsId: Types.ObjectId | CoupleSettingsDocument): coupleSettingsId is CoupleSettingsDocument {
    return typeof coupleSettingsId === 'object' && 'accountId' in coupleSettingsId;
  }

  /**
   * Initialize couple settings when couple account is created
   */
  async initializeCoupleSettings(accountId: string): Promise<CoupleSettingsResponseDto> {
    // Verify account exists and is couple type
    const account = await this.accountModel.findById(accountId);
    if (!account || account.type !== AccountType.COUPLE) {
      throw new BadRequestException('Account not found or not a couple account');
    }

    // Check if settings already exist
    const existingSettings = await this.coupleSettingsModel.findOne({ accountId: new Types.ObjectId(accountId) });
    if (existingSettings) {
      throw new BusinessException('Couple settings already exist for this account', 400, ErrorCode.RESOURCE_ALREADY_EXISTS);
    }

    // Create default couple settings
    const coupleSettings = new this.coupleSettingsModel({
      accountId: new Types.ObjectId(accountId),
      ...DEFAULT_COUPLE_PREFERENCES,
      bothPartnersAccepted: false
    });

    await coupleSettings.save();

    // Update account reference
    account.coupleSettingsId = coupleSettings._id as Types.ObjectId;
    await account.save();

    return this.mapToResponseDto(coupleSettings);
  }

  /**
   * Accept couple invitation and configure initial settings
   */
  async acceptCoupleInvitation(accountId: string, userId: string, acceptDto?: AcceptCoupleInvitationDto): Promise<CoupleSettingsResponseDto> {
    const account = await this.accountModel.findById(accountId).populate('coupleSettingsId');
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    // Verify user is a member of the account
    const isMember = account.members.some(member => member.userId.toString() === userId && member.isActive);
    if (!isMember && account.owner.toString() !== userId) {
      throw new ForbiddenException('User is not a member of this couple account');
    }

    let coupleSettings: CoupleSettingsDocument | null = null;

    // Check if coupleSettingsId is populated (contains object with schema properties) or just an ObjectId
    if (account.coupleSettingsId && this.isPopulatedCoupleSettings(account.coupleSettingsId)) {
      // It's populated
      coupleSettings = account.coupleSettingsId;
    } else if (account.coupleSettingsId) {
      // It's just an ObjectId, fetch it manually
      coupleSettings = await this.coupleSettingsModel.findById(account.coupleSettingsId);
    }

    if (!coupleSettings) {
      // Initialize settings if they don't exist
      await this.initializeCoupleSettings(accountId);
      coupleSettings = await this.coupleSettingsModel.findOne({ accountId: new Types.ObjectId(accountId) });
      if (!coupleSettings) {
        throw new NotFoundException('Failed to initialize couple settings');
      }
    }

    // Update acceptance status
    if (!coupleSettings.invitationAcceptedBy) {
      coupleSettings.invitationAcceptedBy = new Types.ObjectId(userId);
      coupleSettings.invitationAcceptedAt = new Date();
    } else if (coupleSettings.invitationAcceptedBy.toString() !== userId) {
      // Second partner accepting
      coupleSettings.bothPartnersAccepted = true;
      account.bothPartnersAccepted = true;

      // Update premium features based on both users' subscriptions
      this.updatePremiumFeatures(coupleSettings, account);
    }

    // Apply initial preferences if provided
    if (acceptDto?.preferredFinancialModel) {
      coupleSettings.financialModel = acceptDto.preferredFinancialModel;
      account.coupleFinancialModel = acceptDto.preferredFinancialModel;
    }

    if (acceptDto?.initialContributionSettings && coupleSettings.financialModel === CoupleFinancialModel.PROPORTIONAL_INCOME) {
      const partners = this.getAccountPartners(account);
      coupleSettings.contributionSettings = {
        partner1UserId: new Types.ObjectId(partners[0]),
        partner2UserId: new Types.ObjectId(partners[1]),
        partner1ContributionPercentage: acceptDto.initialContributionSettings.partner1ContributionPercentage,
        partner2ContributionPercentage: acceptDto.initialContributionSettings.partner2ContributionPercentage,
        partner1MonthlyIncome: acceptDto.initialContributionSettings.partner1MonthlyIncome,
        partner2MonthlyIncome: acceptDto.initialContributionSettings.partner2MonthlyIncome,
        autoCalculateFromIncome: acceptDto.initialContributionSettings.autoCalculateFromIncome || false,
        lastUpdatedAt: new Date(),
        updatedBy: new Types.ObjectId(userId)
      };
    }

    await coupleSettings.save();
    await account.save();

    return this.mapToResponseDto(coupleSettings);
  }

  /**
   * Update couple settings
   */
  async updateCoupleSettings(accountId: string, userId: string, updateDto: UpdateCoupleSettingsDto): Promise<CoupleSettingsResponseDto> {
    const account = await this.accountModel.findById(accountId).populate('coupleSettingsId');
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    this.verifyUserAccess(account, userId);

    let coupleSettings: CoupleSettingsDocument | null = null;

    // Check if coupleSettingsId is populated (contains object with schema properties) or just an ObjectId
    if (account.coupleSettingsId && this.isPopulatedCoupleSettings(account.coupleSettingsId)) {
      // It's populated
      coupleSettings = account.coupleSettingsId;
    } else if (account.coupleSettingsId) {
      // It's just an ObjectId, fetch it manually
      coupleSettings = await this.coupleSettingsModel.findById(account.coupleSettingsId);
    }

    if (!coupleSettings) {
      throw new NotFoundException('Couple settings not found');
    }

    // Validate financial model change requirements
    if (updateDto.financialModel && updateDto.financialModel !== coupleSettings.financialModel) {
      this.validateFinancialModelChange(updateDto.financialModel, updateDto);
    }

    // Track setting changes for audit trail
    const settingsHistory = this.buildSettingsHistory(coupleSettings, updateDto, userId);

    // Apply updates
    Object.assign(coupleSettings, updateDto);

    // Update contribution settings if provided
    if (updateDto.contributionSettings) {
      const partners = this.getAccountPartners(account);

      coupleSettings.contributionSettings = {
        partner1UserId: new Types.ObjectId(partners[0]),
        partner2UserId: new Types.ObjectId(partners[1]),
        partner1ContributionPercentage: updateDto.contributionSettings.partner1ContributionPercentage,
        partner2ContributionPercentage: updateDto.contributionSettings.partner2ContributionPercentage,
        partner1MonthlyIncome: updateDto.contributionSettings.partner1MonthlyIncome,
        partner2MonthlyIncome: updateDto.contributionSettings.partner2MonthlyIncome,
        autoCalculateFromIncome: updateDto.contributionSettings.autoCalculateFromIncome || false,
        lastUpdatedAt: new Date(),
        updatedBy: new Types.ObjectId(userId)
      };

      // Add to settings history
      settingsHistory.push({
        setting: 'contributionSettings',
        oldValue: coupleSettings.contributionSettings,
        newValue: updateDto.contributionSettings,
        changedBy: new Types.ObjectId(userId),
        changedAt: new Date(),
        reason: updateDto.contributionSettings.reason
      });
    }

    // Update settings history
    coupleSettings.settingsHistory.push(...settingsHistory);

    // Update account reference fields
    if (updateDto.financialModel) {
      account.coupleFinancialModel = updateDto.financialModel;
    }
    account.coupleSettingsLastUpdated = new Date();

    await coupleSettings.save();
    await account.save();

    return this.mapToResponseDto(coupleSettings);
  }

  /**
   * Get couple dashboard statistics
   */
  async getCoupleStats(accountId: string, userId: string, dateRange?: { startDate: Date; endDate: Date }): Promise<CoupleStatsDto> {
    const account = await this.accountModel.findById(accountId).populate('coupleSettingsId');
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    this.verifyUserAccess(account, userId);

    let coupleSettings: CoupleSettingsDocument | null = null;

    // Check if coupleSettingsId is populated (contains object with schema properties) or just an ObjectId
    if (account.coupleSettingsId && this.isPopulatedCoupleSettings(account.coupleSettingsId)) {
      // It's populated
      coupleSettings = account.coupleSettingsId;
    } else if (account.coupleSettingsId) {
      // It's just an ObjectId, fetch it manually
      coupleSettings = await this.coupleSettingsModel.findById(account.coupleSettingsId);
    }

    if (!coupleSettings) {
      throw new NotFoundException('Couple settings not found');
    }

    const partners = this.getAccountPartners(account);
    const partnerId = partners.find(p => p !== userId);

    if (!partnerId) {
      throw new BadRequestException('Partner not found in couple account');
    }

    const startDate = dateRange?.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = dateRange?.endDate || new Date();

    // Base expense query
    const expenseQuery = {
      accountId: new Types.ObjectId(accountId),
      date: { $gte: startDate, $lte: endDate },
      isDeleted: false
    };

    // Get expenses based on financial model
    const stats = await this.calculateStatsBasedOnFinancialModel(coupleSettings.financialModel, expenseQuery, userId, partnerId, coupleSettings);

    // Get top shared categories
    const topSharedCategories = this.getTopSharedCategories();

    // Get monthly trend
    const monthlyTrend = this.getMonthlyTrend();

    // Get hidden gifts count if gift mode is enabled
    let hiddenGiftsCount: number | undefined;
    if (coupleSettings.giftModeEnabled) {
      hiddenGiftsCount = await this.expenseModel.countDocuments({
        ...expenseQuery,
        'coupleData.isGift': true,
        'coupleData.isRevealed': false,
        'coupleData.giftFor': userId
      });
    }

    return {
      totalSharedExpensesThisMonth: stats.totalSharedExpensesThisMonth || 0,
      totalPersonalExpensesThisMonth: stats.totalPersonalExpensesThisMonth || 0,
      partnerPersonalExpensesThisMonth: stats.partnerPersonalExpensesThisMonth || 0,
      userContributionPercentage: stats.userContributionPercentage || 0,
      partnerContributionPercentage: stats.partnerContributionPercentage || 0,
      userTotalContribution: stats.userTotalContribution || 0,
      partnerTotalContribution: stats.partnerTotalContribution || 0,
      outstandingBalance: stats.outstandingBalance || 0,
      topSharedCategories,
      monthlyTrend,
      hiddenGiftsCount
    };
  }

  /**
   * Add comment to couple expense
   */
  async addExpenseComment(expenseId: string, userId: string, comment: string): Promise<{ success: boolean; comment: any }> {
    const expense = await this.expenseModel.findById(expenseId);
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    // Verify it's a couple expense
    if (!expense.coupleData) {
      throw new BadRequestException('Comments are only available for couple expenses');
    }

    // Verify user has access to the account
    const account = await this.accountModel.findById(expense.accountId);
    if (!account || account.type !== AccountType.COUPLE) {
      throw new BadRequestException('Expense is not in a couple account');
    }

    this.verifyUserAccess(account, userId);

    // Check if comments are allowed
    const coupleSettings = await this.coupleSettingsModel.findOne({ accountId: expense.accountId });
    if (!coupleSettings?.allowComments) {
      throw new ForbiddenException('Comments are disabled for this couple account');
    }

    // Add comment
    const newComment = {
      userId, // UUID string
      text: comment.trim(),
      createdAt: new Date(),
      isEdited: false
    };

    if (!expense.coupleData.comments) {
      expense.coupleData.comments = [];
    }

    expense.coupleData.comments.push(newComment);
    await expense.save();

    return {
      success: true,
      comment: {
        ...newComment,
        userId: newComment.userId // Already a UUID string
      }
    };
  }

  /**
   * Add reaction to couple expense
   */
  async addExpenseReaction(expenseId: string, userId: string, reactionType: CoupleReactionType): Promise<{ success: boolean; reaction: any }> {
    const expense = await this.expenseModel.findById(expenseId);
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    // Verify it's a couple expense
    if (!expense.coupleData) {
      throw new BadRequestException('Reactions are only available for couple expenses');
    }

    // Verify user has access
    const account = await this.accountModel.findById(expense.accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    this.verifyUserAccess(account, userId);

    // Check if reactions are allowed
    const coupleSettings = await this.coupleSettingsModel.findOne({ accountId: expense.accountId });
    if (!coupleSettings?.allowReactions) {
      throw new ForbiddenException('Reactions are disabled for this couple account');
    }

    // Remove existing reaction from this user
    if (!expense.coupleData.reactions) {
      expense.coupleData.reactions = [];
    }

    expense.coupleData.reactions = expense.coupleData.reactions.filter(reaction => reaction.userId !== userId);

    // Add new reaction
    const newReaction = {
      userId, // UUID string
      type: reactionType,
      createdAt: new Date()
    };

    expense.coupleData.reactions.push(newReaction);
    await expense.save();

    return {
      success: true,
      reaction: {
        ...newReaction,
        userId: newReaction.userId // Already a UUID string
      }
    };
  }

  /**
   * Get couple settings
   */
  async getCoupleSettings(accountId: string, userId: string): Promise<CoupleSettingsResponseDto> {
    const account = await this.accountModel.findById(accountId).populate('coupleSettingsId');
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    this.verifyUserAccess(account, userId);

    let coupleSettings: CoupleSettingsDocument | null = null;

    // Check if coupleSettingsId is populated (contains object with schema properties) or just an ObjectId
    if (account.coupleSettingsId && this.isPopulatedCoupleSettings(account.coupleSettingsId)) {
      // It's populated
      coupleSettings = account.coupleSettingsId;
    } else if (account.coupleSettingsId) {
      // It's just an ObjectId, fetch it manually
      coupleSettings = await this.coupleSettingsModel.findById(account.coupleSettingsId);
    }

    if (!coupleSettings) {
      throw new NotFoundException('Couple settings not found');
    }

    return this.mapToResponseDto(coupleSettings);
  }

  // Private helper methods
  private verifyUserAccess(account: AccountDocument, userId: string): void {
    const hasAccess = account.owner.toString() === userId || account.members.some(member => member.userId.toString() === userId && member.isActive);

    if (!hasAccess) {
      throw new ForbiddenException('User does not have access to this couple account');
    }
  }

  private getAccountPartners(account: AccountDocument): string[] {
    const partners = [account.owner.toString()];

    account.members.forEach(member => {
      if (member.isActive && !partners.includes(member.userId.toString())) {
        partners.push(member.userId.toString());
      }
    });

    return partners;
  }

  private validateFinancialModelChange(newModel: CoupleFinancialModel, updateDto: UpdateCoupleSettingsDto): void {
    if (newModel === CoupleFinancialModel.PROPORTIONAL_INCOME) {
      if (!updateDto.contributionSettings) {
        throw new BadRequestException('Contribution settings are required for proportional income model');
      }

      const total = updateDto.contributionSettings.partner1ContributionPercentage + updateDto.contributionSettings.partner2ContributionPercentage;

      if (Math.abs(total - 100) > 0.01) {
        throw new BadRequestException('Contribution percentages must sum to 100%');
      }
    }
  }

  private buildSettingsHistory(
    currentSettings: CoupleSettingsDocument,
    updateDto: UpdateCoupleSettingsDto,
    userId: string
  ): Array<{
    setting: string;
    oldValue: any;
    newValue: any;
    changedBy: Types.ObjectId;
    changedAt: Date;
    reason?: string;
  }> {
    const history: Array<{
      setting: string;
      oldValue: any;
      newValue: any;
      changedBy: Types.ObjectId;
      changedAt: Date;
      reason?: string;
    }> = [];

    // Track financial model changes
    if (updateDto.financialModel && updateDto.financialModel !== currentSettings.financialModel) {
      history.push({
        setting: 'financialModel',
        oldValue: currentSettings.financialModel,
        newValue: updateDto.financialModel,
        changedBy: new Types.ObjectId(userId),
        changedAt: new Date()
      });
    }

    // Track other significant changes
    const trackedFields = ['defaultExpenseType', 'allowComments', 'allowReactions', 'giftModeEnabled'];

    trackedFields.forEach(field => {
      if (updateDto[field] !== undefined && updateDto[field] !== currentSettings[field]) {
        history.push({
          setting: field,
          oldValue: currentSettings[field],
          newValue: updateDto[field],
          changedBy: new Types.ObjectId(userId),
          changedAt: new Date()
        });
      }
    });

    return history;
  }

  private updatePremiumFeatures(coupleSettings: CoupleSettingsDocument, account: AccountDocument): void {
    // This would integrate with subscription service to check premium status
    // For now, we'll implement basic logic
    this.getAccountPartners(account);

    // Mock premium status check - replace with actual subscription service integration
    const partner1Premium = false; // await subscriptionService.isUserPremium(partners[0]);
    const partner2Premium = false; // await subscriptionService.isUserPremium(partners[1]);

    let premiumLevel = 'basic';
    if (partner1Premium && partner2Premium) {
      premiumLevel = 'both_premium';
    } else if (partner1Premium || partner2Premium) {
      premiumLevel = 'one_premium';
    }

    const features = COUPLE_PREMIUM_FEATURES[premiumLevel];

    Object.assign(coupleSettings, {
      hasSharedGoals: features.sharedGoals,
      hasDetailedComparisons: features.detailedComparisons,
      hasJointEvolutionPanel: features.jointEvolutionPanel,
      hasDownloadableReports: features.downloadableReports,
      hasAdvancedAnalytics: features.advancedAnalytics,
      hasUnlimitedComments: features.unlimitedComments,
      hasCustomCategories: features.customCategories
    });
  }

  private async calculateStatsBasedOnFinancialModel(
    financialModel: CoupleFinancialModel,
    baseQuery: any,
    userId: string,
    partnerId: string,
    coupleSettings: CoupleSettingsDocument
  ): Promise<Partial<CoupleStatsDto>> {
    // Implementation depends on the financial model
    // This is a simplified version - full implementation would be more complex

    const sharedExpenses = await this.expenseModel.find({
      ...baseQuery,
      'coupleData.expenseType': CoupleExpenseType.SHARED
    });

    const userPersonalExpenses = await this.expenseModel.find({
      ...baseQuery,
      'coupleData.expenseType': CoupleExpenseType.PERSONAL,
      userId: userId
    });

    const partnerPersonalExpenses = await this.expenseModel.find({
      ...baseQuery,
      'coupleData.expenseType': CoupleExpenseType.PERSONAL,
      userId: partnerId
    });

    const totalSharedAmount = sharedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalUserPersonal = userPersonalExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalPartnerPersonal = partnerPersonalExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate contributions based on financial model
    let userContribution = 0;
    let partnerContribution = 0;

    switch (financialModel) {
      case CoupleFinancialModel.FIFTY_FIFTY:
        userContribution = totalSharedAmount / 2;
        partnerContribution = totalSharedAmount / 2;
        break;

      case CoupleFinancialModel.PROPORTIONAL_INCOME:
        if (coupleSettings.contributionSettings) {
          const userPercentage =
            coupleSettings.contributionSettings.partner1UserId.toString() === userId
              ? coupleSettings.contributionSettings.partner1ContributionPercentage
              : coupleSettings.contributionSettings.partner2ContributionPercentage;

          userContribution = (totalSharedAmount * userPercentage) / 100;
          partnerContribution = totalSharedAmount - userContribution;
        }
        break;

      case CoupleFinancialModel.EVERYTHING_COMMON:
        userContribution = (totalSharedAmount + totalUserPersonal + totalPartnerPersonal) / 2;
        partnerContribution = userContribution;
        break;

      case CoupleFinancialModel.MIXED:
        userContribution = totalSharedAmount / 2 + totalUserPersonal;
        partnerContribution = totalSharedAmount / 2 + totalPartnerPersonal;
        break;
    }

    return {
      totalSharedExpensesThisMonth: totalSharedAmount,
      totalPersonalExpensesThisMonth: totalUserPersonal,
      partnerPersonalExpensesThisMonth: totalPartnerPersonal,
      userContributionPercentage: totalSharedAmount > 0 ? (userContribution / totalSharedAmount) * 100 : 0,
      partnerContributionPercentage: totalSharedAmount > 0 ? (partnerContribution / totalSharedAmount) * 100 : 0,
      userTotalContribution: userContribution,
      partnerTotalContribution: partnerContribution,
      outstandingBalance: userContribution - partnerContribution
    };
  }

  private getTopSharedCategories() {
    // Mock implementation - would use aggregation pipeline
    return [];
  }

  private getMonthlyTrend() {
    // Mock implementation - would calculate monthly trends
    return [];
  }

  private mapToResponseDto(coupleSettings: CoupleSettingsDocument): CoupleSettingsResponseDto {
    return {
      accountId: coupleSettings.accountId.toString(),
      financialModel: coupleSettings.financialModel,
      defaultExpenseType: coupleSettings.defaultExpenseType,
      contributionSettings: coupleSettings.contributionSettings
        ? {
            partner1UserId: coupleSettings.contributionSettings.partner1UserId.toString(), // Convert ObjectId to string
            partner2UserId: coupleSettings.contributionSettings.partner2UserId.toString(), // Convert ObjectId to string
            partner1ContributionPercentage: coupleSettings.contributionSettings.partner1ContributionPercentage,
            partner2ContributionPercentage: coupleSettings.contributionSettings.partner2ContributionPercentage,
            partner1MonthlyIncome: coupleSettings.contributionSettings.partner1MonthlyIncome,
            partner2MonthlyIncome: coupleSettings.contributionSettings.partner2MonthlyIncome,
            autoCalculateFromIncome: coupleSettings.contributionSettings.autoCalculateFromIncome,
            lastUpdatedAt: coupleSettings.contributionSettings.lastUpdatedAt,
            updatedBy: coupleSettings.contributionSettings.updatedBy.toString() // Convert ObjectId to string
          }
        : undefined,
      allowComments: coupleSettings.allowComments,
      allowReactions: coupleSettings.allowReactions,
      showContributionStats: coupleSettings.showContributionStats,
      enableCrossReminders: coupleSettings.enableCrossReminders,
      giftModeEnabled: coupleSettings.giftModeEnabled,
      sharedGoalsEnabled: coupleSettings.sharedGoalsEnabled,
      notifications: {
        expenseAdded: coupleSettings.notifications.expenseAdded,
        commentsAndReactions: coupleSettings.notifications.commentsAndReactions,
        giftRevealed: coupleSettings.notifications.giftRevealed,
        reminders: coupleSettings.notifications.reminders,
        budgetAlerts: coupleSettings.notifications.budgetAlerts
      },
      hasSharedGoals: coupleSettings.hasSharedGoals,
      hasDetailedComparisons: coupleSettings.hasDetailedComparisons,
      hasJointEvolutionPanel: coupleSettings.hasJointEvolutionPanel,
      hasDownloadableReports: coupleSettings.hasDownloadableReports,
      hasAdvancedAnalytics: coupleSettings.hasAdvancedAnalytics,
      hasUnlimitedComments: coupleSettings.hasUnlimitedComments,
      hasCustomCategories: coupleSettings.hasCustomCategories,
      invitationAcceptedBy: coupleSettings.invitationAcceptedBy?.toString(), // Convert ObjectId to string
      invitationAcceptedAt: coupleSettings.invitationAcceptedAt,
      bothPartnersAccepted: coupleSettings.bothPartnersAccepted,
      createdAt: coupleSettings.createdAt,
      updatedAt: coupleSettings.updatedAt
    };
  }
}
