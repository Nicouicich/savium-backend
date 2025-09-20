import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { UserProfile, UserProfileDocument } from '../../users/schemas/user-profile.schema';
import { CreateCustomerDto, CreatePaymentDto, CreateSubscriptionDto } from '../dto';
import { BillingCustomer, BillingCustomerDocument } from '../schemas/billing-customer.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { Subscription, SubscriptionDocument } from '../schemas/subscription.schema';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectModel(BillingCustomer.name) private readonly billingCustomerModel: Model<BillingCustomerDocument>,
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(UserProfile.name) private readonly userProfileModel: Model<UserProfileDocument>,
    private readonly configService: ConfigService
  ) {}

  // Customer Management
  async createCustomer(createCustomerDto: CreateCustomerDto, stripeCustomerId: string): Promise<BillingCustomerDocument> {
    const customer = new this.billingCustomerModel({
      userId: createCustomerDto.userId,
      stripeCustomerId,
      email: createCustomerDto.email,
      name: createCustomerDto.name,
      phone: createCustomerDto.phone,
      address: createCustomerDto.address,
      taxId: createCustomerDto.taxId,
      businessName: createCustomerDto.businessName,
      paymentMethods: [],
      preferences: {
        currency: 'usd',
        invoiceDelivery: 'email',
        autoPayment: true
      },
      emailPreferences: {
        billingEmails: true,
        marketingEmails: false,
        productUpdates: true,
        securityAlerts: true
      },
      status: 'active',
      accountBalance: 0,
      creditBalance: 0,
      riskScore: 0,
      riskEvents: []
    });

    const savedCustomer = await customer.save();
    this.logger.log(`Billing customer created: ${savedCustomer._id} for user: ${createCustomerDto.userId}`);
    return savedCustomer;
  }

  async getCustomerByUserId(userId: string): Promise<BillingCustomerDocument> {
    const customer = await this.billingCustomerModel.findOne({ userId: userId });
    if (!customer) {
      throw new NotFoundException('Billing customer not found');
    }
    return customer;
  }

  async getCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomerDocument> {
    const customer = await this.billingCustomerModel.findOne({ stripeCustomerId });
    if (!customer) {
      throw new NotFoundException('Billing customer not found');
    }
    return customer;
  }

  async updateCustomer(userId: string, updateData: Partial<CreateCustomerDto>): Promise<BillingCustomerDocument> {
    const updatedCustomer = await this.billingCustomerModel.findOneAndUpdate({ userId: userId }, { $set: updateData }, { new: true });

    if (!updatedCustomer) {
      throw new NotFoundException('Billing customer not found');
    }

    this.logger.log(`Billing customer updated: ${updatedCustomer._id}`);
    return updatedCustomer;
  }

  // Payment Methods
  async addPaymentMethod(
    userId: string,
    paymentMethodData: {
      stripePaymentMethodId: string;
      type: 'card' | 'bank_account';
      last4: string;
      brand?: string;
      expMonth?: number;
      expYear?: number;
      isDefault?: boolean;
    }
  ): Promise<void> {
    const customer = await this.getCustomerByUserId(userId);

    // If this is set as default, remove default from other methods
    if (paymentMethodData.isDefault) {
      await this.billingCustomerModel.updateOne({ userId: userId }, { $set: { 'paymentMethods.$[].isDefault': false } });
    }

    // Add the new payment method
    await this.billingCustomerModel.updateOne(
      { userId: userId },
      {
        $push: {
          paymentMethods: {
            ...paymentMethodData,
            isDefault: paymentMethodData.isDefault || customer.paymentMethods.length === 0,
            createdAt: new Date()
          }
        }
      }
    );

    this.logger.log(`Payment method added for user: ${userId}`);
  }

  async removePaymentMethod(userId: string, stripePaymentMethodId: string): Promise<void> {
    await this.billingCustomerModel.updateOne({ userId: userId }, { $pull: { paymentMethods: { stripePaymentMethodId } } });

    this.logger.log(`Payment method removed for user: ${userId}`);
  }

  // Subscription Management
  async createSubscription(createSubscriptionDto: CreateSubscriptionDto): Promise<SubscriptionDocument> {
    // Get plan features based on plan type
    const features = this.getPlanFeatures(createSubscriptionDto.plan);

    const subscription = new this.subscriptionModel({
      userId: createSubscriptionDto.userId,
      stripeSubscriptionId: createSubscriptionDto.stripeSubscriptionId,
      stripeCustomerId: createSubscriptionDto.stripeCustomerId,
      stripePriceId: createSubscriptionDto.stripePriceId,
      stripeProductId: createSubscriptionDto.stripeProductId,
      plan: createSubscriptionDto.plan,
      interval: createSubscriptionDto.interval,
      status: 'active',
      amount: createSubscriptionDto.amount,
      currency: createSubscriptionDto.currency || 'usd',
      currentPeriodStart: createSubscriptionDto.currentPeriodStart,
      currentPeriodEnd: createSubscriptionDto.currentPeriodEnd,
      trialStart: createSubscriptionDto.trialStart,
      trialEnd: createSubscriptionDto.trialEnd,
      features,
      usage: {
        accountsCreated: 0,
        transactionsThisMonth: 0,
        budgetsCreated: 0,
        goalsCreated: 0,
        apiCallsThisMonth: 0
      }
    });

    const savedSubscription = await subscription.save();

    // Update customer's active subscription
    await this.billingCustomerModel.updateOne({ userId: createSubscriptionDto.userId }, { $set: { activeSubscriptionId: savedSubscription._id } });

    this.logger.log(`Subscription created: ${savedSubscription._id} for user: ${createSubscriptionDto.userId}`);
    return savedSubscription;
  }

  async getSubscriptionByUserId(userId: string): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel.findOne({ userId: userId }, {}, { sort: { createdAt: -1 } });
  }

  async updateSubscriptionStatus(subscriptionId: string, status: string, metadata?: any): Promise<void> {
    const updateData: any = { status };
    if (metadata) {
      updateData.metadata = metadata;
    }

    await this.subscriptionModel.updateOne({ stripeSubscriptionId: subscriptionId }, { $set: updateData });

    this.logger.log(`Subscription status updated: ${subscriptionId} to ${status}`);
  }

  async cancelSubscription(userId: string, cancelAt?: Date): Promise<void> {
    const updateData: any = {
      status: 'canceled',
      canceledAt: new Date()
    };

    if (cancelAt) {
      updateData.cancelAt = cancelAt;
    }

    await this.subscriptionModel.updateOne({ userId: userId }, { $set: updateData });

    this.logger.log(`Subscription canceled for user: ${userId}`);
  }

  // Usage tracking
  async incrementUsage(userId: string, usageType: keyof Subscription['usage'], amount: number = 1): Promise<void> {
    await this.subscriptionModel.updateOne({ userId: userId, status: 'active' }, { $inc: { [`usage.${String(usageType)}`]: amount } });
  }

  async resetMonthlyUsage(userId: string): Promise<void> {
    await this.subscriptionModel.updateOne(
      { userId: userId },
      {
        $set: {
          'usage.transactionsThisMonth': 0,
          'usage.apiCallsThisMonth': 0
        }
      }
    );
  }

  async checkUsageLimit(userId: string, featureName: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const subscription = await this.getSubscriptionByUserId(userId);
    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    const usageMap: Record<string, { current: keyof Subscription['usage']; limit: keyof Subscription['features'] }> = {
      accounts: { current: 'accountsCreated', limit: 'maxAccounts' },
      transactions: { current: 'transactionsThisMonth', limit: 'maxTransactionsPerMonth' },
      budgets: { current: 'budgetsCreated', limit: 'maxBudgets' },
      goals: { current: 'goalsCreated', limit: 'maxGoals' }
    };

    const feature = usageMap[featureName];
    if (!feature) {
      throw new BadRequestException('Invalid feature name');
    }

    const current = subscription.usage[feature.current] || 0;
    const limitValue = subscription.features[feature.limit];
    const limit = typeof limitValue === 'number' ? limitValue : 0;

    return {
      allowed: current < limit,
      current,
      limit
    };
  }

  // Payment Management
  async createPayment(createPaymentDto: CreatePaymentDto): Promise<PaymentDocument> {
    const payment = new this.paymentModel({
      userId: createPaymentDto.userId,
      subscriptionId: createPaymentDto.subscriptionId ? new Types.ObjectId(createPaymentDto.subscriptionId) : undefined,
      stripePaymentIntentId: createPaymentDto.stripePaymentIntentId,
      stripeChargeId: createPaymentDto.stripeChargeId,
      stripeCustomerId: createPaymentDto.stripeCustomerId,
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency || 'usd',
      status: createPaymentDto.status,
      type: createPaymentDto.type,
      description: createPaymentDto.description,
      receiptUrl: createPaymentDto.receiptUrl,
      paymentMethod: createPaymentDto.paymentMethod,
      billingDetails: createPaymentDto.billingDetails,
      disputed: false,
      processedAt: createPaymentDto.status === 'succeeded' ? new Date() : undefined
    });

    const savedPayment = await payment.save();
    this.logger.log(`Payment created: ${savedPayment._id} for user: ${createPaymentDto.userId}`);
    return savedPayment;
  }

  async getPaymentsByUserId(userId: string, limit: number = 20, skip: number = 0): Promise<PaymentDocument[]> {
    return this.paymentModel.find({ userId: userId }).sort({ createdAt: -1 }).limit(limit).skip(skip).exec();
  }

  // Helper methods
  private getPlanFeatures(plan: string): any {
    const planFeatures: Record<string, any> = {
      free: {
        maxAccounts: 1,
        maxTransactionsPerMonth: 50,
        maxBudgets: 2,
        maxGoals: 1,
        aiCategorization: false,
        advancedReports: false,
        exportData: false,
        prioritySupport: false,
        customCategories: false,
        multiCurrency: false,
        apiAccess: false,
        whiteLabel: false
      },
      basic: {
        maxAccounts: 2,
        maxTransactionsPerMonth: 200,
        maxBudgets: 5,
        maxGoals: 3,
        aiCategorization: true,
        advancedReports: false,
        exportData: true,
        prioritySupport: false,
        customCategories: true,
        multiCurrency: false,
        apiAccess: false,
        whiteLabel: false
      },
      premium: {
        maxAccounts: 5,
        maxTransactionsPerMonth: 1000,
        maxBudgets: 20,
        maxGoals: 10,
        aiCategorization: true,
        advancedReports: true,
        exportData: true,
        prioritySupport: true,
        customCategories: true,
        multiCurrency: true,
        apiAccess: true,
        whiteLabel: false
      },
      family: {
        maxAccounts: 10,
        maxTransactionsPerMonth: 2000,
        maxBudgets: 50,
        maxGoals: 25,
        aiCategorization: true,
        advancedReports: true,
        exportData: true,
        prioritySupport: true,
        customCategories: true,
        multiCurrency: true,
        apiAccess: true,
        whiteLabel: false
      },
      business: {
        maxAccounts: -1, // unlimited
        maxTransactionsPerMonth: -1, // unlimited
        maxBudgets: -1, // unlimited
        maxGoals: -1, // unlimited
        aiCategorization: true,
        advancedReports: true,
        exportData: true,
        prioritySupport: true,
        customCategories: true,
        multiCurrency: true,
        apiAccess: true,
        whiteLabel: true
      }
    };

    return planFeatures[plan] || planFeatures.free;
  }

  // Risk and fraud management
  async updateRiskScore(userId: string, riskScore: number): Promise<void> {
    await this.billingCustomerModel.updateOne({ userId: userId }, { $set: { riskScore } });
  }

  async addRiskEvent(
    userId: string,
    event: {
      type: 'chargeback' | 'refund_request' | 'dispute';
      amount: number;
      reason: string;
    }
  ): Promise<void> {
    await this.billingCustomerModel.updateOne(
      { userId: userId },
      {
        $push: {
          riskEvents: {
            ...event,
            date: new Date(),
            resolved: false
          }
        }
      }
    );
  }

  // Analytics and reporting
  async getBillingStats(userId?: string): Promise<any> {
    const matchStage = userId ? { userId: userId } : {};

    const stats = await this.subscriptionModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSubscriptions: { $sum: 1 },
          activeSubscriptions: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, '$amount', 0] }
          },
          planBreakdown: {
            $push: '$plan'
          }
        }
      }
    ]);

    return (
      stats[0] || {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        totalRevenue: 0,
        planBreakdown: []
      }
    );
  }

  // Multi-profile integration methods

  /**
   * Get features available for a user based on their subscription and active profile
   */
  async getAvailableFeaturesForProfile(userId: string, profileId?: string): Promise<any> {
    const subscription = await this.getSubscriptionByUserId(userId);
    if (!subscription) {
      return this.getPlanFeatures('free');
    }

    let profileContext = {};
    if (profileId) {
      const profile = await this.userProfileModel.findById(profileId);
      if (profile) {
        profileContext = {
          profileType: profile.profileType,
          businessContext: profile.profileType === 'business' || profile.profileType === 'professional',
          enhancedPrivacy: profile.privacy?.visibility === 'private'
        };
      }
    }

    return {
      ...subscription.features,
      profileContext,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    };
  }

  /**
   * Check if a feature is available for a specific profile type
   */
  async isFeatureAvailableForProfile(userId: string, featureName: string, profileId?: string): Promise<boolean> {
    const subscription = await this.getSubscriptionByUserId(userId);
    if (!subscription) {
      return false;
    }

    const features = subscription.features;
    const baseFeatureAvailable = features[featureName] === true || features[featureName] > 0;

    if (!profileId) {
      return baseFeatureAvailable;
    }

    const profile = await this.userProfileModel.findById(profileId);
    if (!profile) {
      return baseFeatureAvailable;
    }

    // Enhanced logic based on profile type
    switch (profile.profileType) {
      case 'business':
      case 'professional':
        // Business and professional profiles get enhanced features
        return baseFeatureAvailable && ['premium', 'family', 'business'].includes(subscription.plan);
      case 'family':
        // Family profiles have different usage patterns
        return baseFeatureAvailable && ['family', 'business'].includes(subscription.plan);
      case 'personal':
      default:
        return baseFeatureAvailable;
    }
  }

  /**
   * Update billing preferences based on profile context
   */
  async updateBillingPreferencesForProfile(userId: string, profileId: string, preferences: any): Promise<void> {
    const profile = await this.userProfileModel.findById(profileId);
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const billingPreferences: any = {
      ...preferences
    };

    // Adjust preferences based on profile type
    if (profile.profileType === 'business' || profile.profileType === 'professional') {
      billingPreferences.invoiceDelivery = 'email';
      billingPreferences.requireBusinessInfo = true;
    }

    if (profile.privacy?.visibility === 'private') {
      billingPreferences.enhancedPrivacy = true;
    }

    await this.billingCustomerModel.updateOne({ userId: userId }, { $set: { preferences: billingPreferences } });

    this.logger.log(`Billing preferences updated for user: ${userId}, profile: ${profileId}`);
  }

  /**
   * Get usage recommendations based on profile type and current plan
   */
  async getUsageRecommendations(userId: string, profileId?: string): Promise<any> {
    const subscription = await this.getSubscriptionByUserId(userId);
    if (!subscription) {
      return {
        currentPlan: 'free',
        recommendations: ['Consider upgrading to a paid plan for enhanced features'],
        suggestedPlan: 'basic'
      };
    }

    const recommendations: string[] = [];
    let suggestedPlan = subscription.plan;

    if (profileId) {
      const profile = await this.userProfileModel.findById(profileId);
      if (profile) {
        const usage = subscription.usage;
        const features = subscription.features;

        // Check usage against limits
        if (usage.accountsCreated >= features.maxAccounts * 0.8) {
          recommendations.push('You are approaching your account limit. Consider upgrading for more accounts.');
        }

        if (usage.transactionsThisMonth >= features.maxTransactionsPerMonth * 0.8) {
          recommendations.push('You are approaching your monthly transaction limit.');
        }

        // Profile-specific recommendations
        switch (profile.profileType) {
          case 'business':
          case 'professional':
            if (subscription.plan !== 'business') {
              recommendations.push('Business profiles benefit from advanced reporting and unlimited accounts.');
              suggestedPlan = 'business';
            }
            break;
          case 'family':
            if (subscription.plan === 'basic') {
              recommendations.push('Family accounts benefit from the family plan with higher limits.');
              suggestedPlan = 'family';
            }
            break;
        }
      }
    }

    return {
      currentPlan: subscription.plan,
      currentUsage: subscription.usage,
      planLimits: subscription.features,
      recommendations,
      suggestedPlan: suggestedPlan !== subscription.plan ? suggestedPlan : null
    };
  }

  /**
   * Create billing customer with profile-aware defaults
   */
  async createCustomerWithProfile(createCustomerDto: CreateCustomerDto, stripeCustomerId: string, activeProfileId?: string): Promise<BillingCustomerDocument> {
    let profileAwareDefaults = {};

    if (activeProfileId) {
      const profile = await this.userProfileModel.findById(activeProfileId);
      if (profile) {
        profileAwareDefaults = {
          businessName: profile.company || profile.name,
          taxIdType: profile.profileType === 'business' ? 'company' : 'individual',
          preferences: {
            currency: 'usd',
            invoiceDelivery: 'email',
            autoPayment: true,
            billingThreshold: profile.profileType === 'business' ? 1000 : 100
          }
        };
      }
    }

    const customerData = {
      ...createCustomerDto,
      ...profileAwareDefaults
    };

    return this.createCustomer(customerData, stripeCustomerId);
  }
}
