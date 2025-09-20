import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Account, AccountDocument } from '../schemas/account.schema';
import { CoupleSettings, CoupleSettingsDocument } from '../schemas/couple-settings.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';

import { COUPLE_PREMIUM_FEATURES, CoupePremiumFeatures } from '@common/constants/couple-types';
import { AccountType } from '@common/constants/account-types';

export interface PremiumFeatureStatus {
  featureName: string;
  enabled: boolean;
  requiredPremiumLevel: 'basic' | 'one_premium' | 'both_premium';
  currentPremiumLevel: 'basic' | 'one_premium' | 'both_premium';
  description: string;
  limitations?: string[];
}

export interface CoupleSubscriptionStatus {
  partner1: {
    userId: string;
    name: string;
    hasPremium: boolean;
    subscriptionType?: string;
    expiresAt?: Date;
  };
  partner2: {
    userId: string;
    name: string;
    hasPremium: boolean;
    subscriptionType?: string;
    expiresAt?: Date;
  };
  coupleLevel: 'basic' | 'one_premium' | 'both_premium';
  availableFeatures: CoupePremiumFeatures;
  upgradeRecommendation?: {
    benefit: string;
    cost: number;
    features: string[];
  };
}

@Injectable()
export class CouplePremiumService {
  constructor(
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
    @InjectModel(CoupleSettings.name)
    private readonly coupleSettingsModel: Model<CoupleSettingsDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>
  ) {}

  /**
   * Type predicate to check if coupleSettingsId is populated
   */
  private isPopulatedCoupleSettings(coupleSettingsId: Types.ObjectId | CoupleSettingsDocument): coupleSettingsId is CoupleSettingsDocument {
    return typeof coupleSettingsId === 'object' && 'accountId' in coupleSettingsId;
  }

  /**
   * Check and update premium features for a couple account
   */
  async updateCouplePremiumFeatures(accountId: string): Promise<CoupePremiumFeatures> {
    const account = await this.accountModel.findById(accountId).populate('coupleSettingsId');
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    if (!account.coupleSettingsId) {
      throw new NotFoundException('Couple settings not found');
    }

    const coupleSettings = await this.coupleSettingsModel.findOne({ accountId: account._id });
    if (!coupleSettings) {
      throw new NotFoundException('Couple settings not found');
    }

    const partners = this.getAccountPartners(account);
    if (partners.length !== 2) {
      throw new Error('Couple account must have exactly 2 partners');
    }

    // Check premium status for both partners
    const partner1Premium = await this.checkUserPremiumStatus(partners[0]);
    const partner2Premium = await this.checkUserPremiumStatus(partners[1]);

    // Determine couple premium level
    let premiumLevel: 'basic' | 'one_premium' | 'both_premium' = 'basic';
    if (partner1Premium.hasPremium && partner2Premium.hasPremium) {
      premiumLevel = 'both_premium';
    } else if (partner1Premium.hasPremium || partner2Premium.hasPremium) {
      premiumLevel = 'one_premium';
    }

    // Get feature configuration for this level
    const features = COUPLE_PREMIUM_FEATURES[premiumLevel];

    // Update couple settings with new premium features
    await this.coupleSettingsModel.findByIdAndUpdate(
      coupleSettings._id,
      {
        hasSharedGoals: features.sharedGoals,
        hasDetailedComparisons: features.detailedComparisons,
        hasJointEvolutionPanel: features.jointEvolutionPanel,
        hasDownloadableReports: features.downloadableReports,
        hasAdvancedAnalytics: features.advancedAnalytics,
        hasUnlimitedComments: features.unlimitedComments,
        hasCustomCategories: features.customCategories,
        updatedAt: new Date()
      },
      { new: true }
    );

    return {
      sharedGoals: features.sharedGoals,
      detailedComparisons: features.detailedComparisons,
      jointEvolutionPanel: features.jointEvolutionPanel,
      downloadableReports: features.downloadableReports,
      advancedAnalytics: features.advancedAnalytics,
      unlimitedComments: features.unlimitedComments,
      customCategories: features.customCategories
    };
  }

  /**
   * Get subscription status for a couple
   */
  async getCoupleSubscriptionStatus(accountId: string, userId: string): Promise<CoupleSubscriptionStatus> {
    const account = await this.accountModel.findById(accountId);
    if (!account || account.type !== AccountType.COUPLE) {
      throw new NotFoundException('Couple account not found');
    }

    this.verifyUserAccess(account, userId);

    const partners = this.getAccountPartners(account);
    const partner1Details = await this.userModel.findById(partners[0]);
    const partner2Details = await this.userModel.findById(partners[1]);

    if (!partner1Details || !partner2Details) {
      throw new NotFoundException('Partner details not found');
    }

    const partner1Premium = await this.checkUserPremiumStatus(partners[0]);
    const partner2Premium = await this.checkUserPremiumStatus(partners[1]);

    let coupleLevel: 'basic' | 'one_premium' | 'both_premium' = 'basic';
    if (partner1Premium.hasPremium && partner2Premium.hasPremium) {
      coupleLevel = 'both_premium';
    } else if (partner1Premium.hasPremium || partner2Premium.hasPremium) {
      coupleLevel = 'one_premium';
    }

    const availableFeatures = COUPLE_PREMIUM_FEATURES[coupleLevel];

    // Generate upgrade recommendation if applicable
    let upgradeRecommendation: any;
    if (coupleLevel !== 'both_premium') {
      upgradeRecommendation = this.generateUpgradeRecommendation(coupleLevel);
    }

    return {
      partner1: {
        userId: partners[0],
        name: `${partner1Details.firstName} ${partner1Details.lastName}`,
        hasPremium: partner1Premium.hasPremium,
        subscriptionType: partner1Premium.subscriptionType,
        expiresAt: partner1Premium.expiresAt
      },
      partner2: {
        userId: partners[1],
        name: `${partner2Details.firstName} ${partner2Details.lastName}`,
        hasPremium: partner2Premium.hasPremium,
        subscriptionType: partner2Premium.subscriptionType,
        expiresAt: partner2Premium.expiresAt
      },
      coupleLevel,
      availableFeatures,
      upgradeRecommendation
    };
  }

  /**
   * Check if a specific premium feature is available for the couple
   */
  async isFeatureAvailable(accountId: string, userId: string, featureName: keyof CoupePremiumFeatures): Promise<PremiumFeatureStatus> {
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

    const subscriptionStatus = await this.getCoupleSubscriptionStatus(accountId, userId);

    const featureDescriptions: Record<keyof CoupePremiumFeatures, string> = {
      sharedGoals: 'Create and track financial goals together as a couple',
      detailedComparisons: 'Advanced spending comparisons and analytics between partners',
      jointEvolutionPanel: 'Joint financial evolution dashboard with trends and insights',
      downloadableReports: 'Download detailed financial reports and statements',
      advancedAnalytics: 'AI-powered insights and behavioral analytics',
      unlimitedComments: 'Unlimited comments on transactions and transactions',
      customCategories: 'Create custom transaction categories tailored to your needs'
    };

    const featureLimitations: Record<keyof CoupePremiumFeatures, string[]> = {
      sharedGoals: ['Limited to 3 shared goals', 'Basic goal tracking only'],
      detailedComparisons: ['Basic comparison views only', 'Limited historical data'],
      jointEvolutionPanel: ['Basic dashboard view', 'No advanced charts'],
      downloadableReports: ['No report downloads', 'View-only access'],
      advancedAnalytics: ['Basic analytics only', 'No AI insights'],
      unlimitedComments: ['Limited to 10 comments per transaction', 'Basic emoji reactions only'],
      customCategories: ['Standard categories only', 'Cannot create custom categories']
    };

    // Determine required premium level for this feature
    let requiredLevel: 'basic' | 'one_premium' | 'both_premium' = 'basic';
    for (const [level, features] of Object.entries(COUPLE_PREMIUM_FEATURES)) {
      if (features[featureName]) {
        requiredLevel = level as any;
        break;
      }
    }

    const isEnabled = subscriptionStatus.availableFeatures[featureName];

    return {
      featureName,
      enabled: isEnabled,
      requiredPremiumLevel: requiredLevel,
      currentPremiumLevel: subscriptionStatus.coupleLevel,
      description: featureDescriptions[featureName],
      limitations: !isEnabled ? featureLimitations[featureName] : undefined
    };
  }

  /**
   * Get all premium features status for a couple
   */
  async getAllFeaturesStatus(accountId: string, userId: string): Promise<PremiumFeatureStatus[]> {
    const featureNames: (keyof CoupePremiumFeatures)[] = [
      'sharedGoals',
      'detailedComparisons',
      'jointEvolutionPanel',
      'downloadableReports',
      'advancedAnalytics',
      'unlimitedComments',
      'customCategories'
    ];

    const statusList = await Promise.all(featureNames.map(featureName => this.isFeatureAvailable(accountId, userId, featureName)));

    return statusList;
  }

  /**
   * Cron job to refresh premium features for all couple accounts
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshAllCouplePremiumFeatures(): Promise<void> {
    try {
      console.log('Starting daily refresh of couple premium features...');

      const coupleAccounts = await this.accountModel.find({
        type: AccountType.COUPLE,
        isDeleted: false,
        status: 'active'
      });

      let successCount = 0;
      let errorCount = 0;

      for (const account of coupleAccounts) {
        try {
          await this.updateCouplePremiumFeatures(account.id);
          successCount++;
        } catch (error) {
          console.error(`Error refreshing premium features for account ${account.id}:`, error);
          errorCount++;
        }
      }

      console.log(`Premium features refresh completed. Success: ${successCount}, Errors: ${errorCount}`);
    } catch (error) {
      console.error('Error in refreshAllCouplePremiumFeatures cron job:', error);
    }
  }

  /**
   * Handle premium feature usage tracking (for limits)
   */
  async trackFeatureUsage(
    accountId: string,
    userId: string,
    featureName: keyof CoupePremiumFeatures
  ): Promise<{
    allowed: boolean;
    remaining?: number;
    limit?: number;
    message?: string;
  }> {
    const featureStatus = await this.isFeatureAvailable(accountId, userId, featureName);

    if (!featureStatus.enabled) {
      return {
        allowed: false,
        message: `${featureName} requires premium subscription`
      };
    }

    // For basic users, implement usage limits
    if (featureStatus.currentPremiumLevel === 'basic') {
      // This would integrate with a usage tracking service
      // For now, always allow for enabled features
      return { allowed: true };
    }

    // For premium users, check specific limits
    switch (featureName) {
      case 'unlimitedComments':
        if (featureStatus.currentPremiumLevel === 'one_premium') {
          // Could implement a monthly limit for single premium
          return { allowed: true, remaining: 50, limit: 100 };
        }
        return { allowed: true }; // Truly unlimited for both premium

      case 'sharedGoals':
        if (featureStatus.currentPremiumLevel === 'one_premium') {
          // Could limit number of active goals
          return { allowed: true, remaining: 2, limit: 5 };
        }
        return { allowed: true }; // Unlimited for both premium

      default:
        return { allowed: true };
    }
  }

  // Private helper methods
  private async checkUserPremiumStatus(userId: string): Promise<{
    hasPremium: boolean;
    subscriptionType?: string;
    expiresAt?: Date;
  }> {
    // This would integrate with your subscription/billing service
    // For now, return mock data based on user metadata or a simple flag

    const user = await this.userModel.findById(userId);
    if (!user) {
      return { hasPremium: false };
    }

    // Check user's subscription status from metadata or dedicated subscription service
    const premiumStatus = user.metadata?.subscription || {};

    return {
      hasPremium: premiumStatus.isPremium || false,
      subscriptionType: premiumStatus.type || undefined,
      expiresAt: premiumStatus.expiresAt ? new Date(premiumStatus.expiresAt) : undefined
    };
  }

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

  private generateUpgradeRecommendation(currentLevel: 'basic' | 'one_premium'): {
    benefit: string;
    cost: number;
    features: string[];
  } {
    if (currentLevel === 'basic') {
      return {
        benefit: 'Upgrade to Premium for advanced couple features',
        cost: 9.99, // Mock pricing
        features: ['Unlimited comments and reactions', 'Custom transaction categories', 'Enhanced analytics']
      };
    } else {
      return {
        benefit: 'Get both partners Premium for full couple experience',
        cost: 9.99, // Cost for second partner
        features: ['Shared financial goals', 'Detailed comparative analytics', 'Joint evolution dashboard', 'Downloadable reports', 'AI-powered insights']
      };
    }
  }
}
