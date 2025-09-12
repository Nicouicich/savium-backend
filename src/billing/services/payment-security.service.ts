import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

import { EnhancedPayment, EnhancedPaymentDocument } from '../schemas/enhanced-payment.schema';
import { BillingCustomer, BillingCustomerDocument } from '../schemas/billing-customer.schema';

export interface SecurityCheckResult {
  allowed: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  metadata?: Record<string, any>;
}

export interface PaymentRiskAssessment {
  score: number; // 0-100
  level: 'normal' | 'elevated' | 'highest';
  factors: Array<{
    type: string;
    weight: number;
    description: string;
  }>;
}

@Injectable()
export class PaymentSecurityService {
  private readonly logger = new Logger(PaymentSecurityService.name);

  private readonly MAX_DAILY_AMOUNT = 10000; // $10,000 USD equivalent
  private readonly MAX_MONTHLY_AMOUNT = 50000; // $50,000 USD equivalent
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly BLOCKED_COUNTRIES = ['IR', 'KP', 'SY']; // Example blocked countries
  private readonly HIGH_RISK_COUNTRIES = ['AF', 'BY', 'MM', 'ZW'];

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(EnhancedPayment.name) private paymentModel: Model<EnhancedPaymentDocument>,
    @InjectModel(BillingCustomer.name) private customerModel: Model<BillingCustomerDocument>
  ) {}

  /**
   * Perform comprehensive security check before processing payment
   */
  async performSecurityCheck(userId: string, amount: number, currency: string, paymentMethodDetails?: any, billingDetails?: any): Promise<SecurityCheckResult> {
    const traceId = uuidv4();
    this.logger.log(`Performing security check`, {
      traceId,
      userId,
      amount,
      currency
    });

    const checks = await Promise.all([
      this.checkDailyLimits(userId, amount, currency),
      this.checkMonthlyLimits(userId, amount, currency),
      this.checkFailedAttempts(userId),
      this.checkGeographicRestrictions(billingDetails),
      this.checkVelocityLimits(userId),
      this.checkPaymentMethodRisk(paymentMethodDetails),
      this.checkCustomerHistory(userId)
    ]);

    const failedChecks = checks.filter(check => !check.allowed);
    const riskFactors = checks.map(check => check.reasons).flat();

    // Calculate overall risk level
    const riskLevel = this.calculateOverallRiskLevel(checks);

    // Determine if payment should be allowed
    const allowed = failedChecks.length === 0 && riskLevel !== 'critical';

    this.logger.log(`Security check completed`, {
      traceId,
      userId,
      allowed,
      riskLevel,
      failedChecks: failedChecks.length
    });

    return {
      allowed,
      riskLevel,
      reasons: riskFactors,
      metadata: {
        traceId,
        checksPerformed: checks.length,
        failedChecks: failedChecks.length
      }
    };
  }

  /**
   * Assess payment risk for fraud detection
   */
  async assessPaymentRisk(userId: string, amount: number, currency: string, paymentMethodDetails?: any, billingDetails?: any): Promise<PaymentRiskAssessment> {
    const factors: Array<{ type: string; weight: number; description: string }> = [];
    let totalScore = 0;

    // Amount-based risk factors
    const normalizedAmount = this.normalizeAmount(amount, currency);
    if (normalizedAmount > 1000) {
      const weight = Math.min(30, (normalizedAmount / 1000) * 5);
      factors.push({
        type: 'high_amount',
        weight,
        description: `High payment amount: $${normalizedAmount}`
      });
      totalScore += weight;
    }

    // Geographic risk factors
    if (billingDetails?.address?.country) {
      const countryRisk = this.assessCountryRisk(billingDetails.address.country);
      if (countryRisk > 0) {
        factors.push({
          type: 'geographic_risk',
          weight: countryRisk,
          description: `High-risk country: ${billingDetails.address.country}`
        });
        totalScore += countryRisk;
      }
    }

    // Payment method risk factors
    if (paymentMethodDetails) {
      const pmRisk = this.assessPaymentMethodRisk(paymentMethodDetails);
      if (pmRisk > 0) {
        factors.push({
          type: 'payment_method_risk',
          weight: pmRisk,
          description: 'Payment method has elevated risk indicators'
        });
        totalScore += pmRisk;
      }
    }

    // Customer history risk factors
    const historyRisk = await this.assessCustomerHistoryRisk(userId);
    if (historyRisk > 0) {
      factors.push({
        type: 'customer_history',
        weight: historyRisk,
        description: 'Customer payment history indicates elevated risk'
      });
      totalScore += historyRisk;
    }

    // Velocity risk factors
    const velocityRisk = await this.assessVelocityRisk(userId);
    if (velocityRisk > 0) {
      factors.push({
        type: 'velocity_risk',
        weight: velocityRisk,
        description: 'Unusual payment velocity detected'
      });
      totalScore += velocityRisk;
    }

    // Determine risk level
    let level: 'normal' | 'elevated' | 'highest';
    if (totalScore < 30) {
      level = 'normal';
    } else if (totalScore < 70) {
      level = 'elevated';
    } else {
      level = 'highest';
    }

    return {
      score: Math.min(100, totalScore),
      level,
      factors
    };
  }

  /**
   * Check daily spending limits
   */
  private async checkDailyLimits(userId: string, amount: number, currency: string): Promise<SecurityCheckResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailySpending = await this.paymentModel.aggregate([
      {
        $match: {
          userId,
          status: 'succeeded',
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const currentSpending = dailySpending[0]?.total || 0;
    const normalizedAmount = this.normalizeAmount(amount, currency);
    const normalizedCurrent = this.normalizeAmount(currentSpending, currency);

    const wouldExceedLimit = normalizedCurrent + normalizedAmount > this.MAX_DAILY_AMOUNT;

    return {
      allowed: !wouldExceedLimit,
      riskLevel: wouldExceedLimit ? 'high' : 'low',
      reasons: wouldExceedLimit ? ['Daily spending limit exceeded'] : [],
      metadata: { currentSpending: normalizedCurrent, limit: this.MAX_DAILY_AMOUNT }
    };
  }

  /**
   * Check monthly spending limits
   */
  private async checkMonthlyLimits(userId: string, amount: number, currency: string): Promise<SecurityCheckResult> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlySpending = await this.paymentModel.aggregate([
      {
        $match: {
          userId,
          status: 'succeeded',
          createdAt: { $gte: monthStart }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const currentSpending = monthlySpending[0]?.total || 0;
    const normalizedAmount = this.normalizeAmount(amount, currency);
    const normalizedCurrent = this.normalizeAmount(currentSpending, currency);

    const wouldExceedLimit = normalizedCurrent + normalizedAmount > this.MAX_MONTHLY_AMOUNT;

    return {
      allowed: !wouldExceedLimit,
      riskLevel: wouldExceedLimit ? 'high' : 'low',
      reasons: wouldExceedLimit ? ['Monthly spending limit exceeded'] : [],
      metadata: { currentSpending: normalizedCurrent, limit: this.MAX_MONTHLY_AMOUNT }
    };
  }

  /**
   * Check failed payment attempts
   */
  private async checkFailedAttempts(userId: string): Promise<SecurityCheckResult> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failedAttempts = await this.paymentModel.countDocuments({
      userId,
      status: 'failed',
      createdAt: { $gte: last24Hours }
    });

    const tooManyFailures = failedAttempts >= this.MAX_FAILED_ATTEMPTS;

    return {
      allowed: !tooManyFailures,
      riskLevel: tooManyFailures ? 'critical' : 'low',
      reasons: tooManyFailures ? ['Too many failed payment attempts'] : [],
      metadata: { failedAttempts, limit: this.MAX_FAILED_ATTEMPTS }
    };
  }

  /**
   * Check geographic restrictions
   */
  private checkGeographicRestrictions(billingDetails?: any): SecurityCheckResult {
    if (!billingDetails?.address?.country) {
      return {
        allowed: true,
        riskLevel: 'low',
        reasons: []
      };
    }

    const country = billingDetails.address.country.toUpperCase();
    const isBlocked = this.BLOCKED_COUNTRIES.includes(country);
    const isHighRisk = this.HIGH_RISK_COUNTRIES.includes(country);

    return {
      allowed: !isBlocked,
      riskLevel: isBlocked ? 'critical' : isHighRisk ? 'high' : 'low',
      reasons: isBlocked ? [`Payments blocked from country: ${country}`] : isHighRisk ? [`High-risk country: ${country}`] : [],
      metadata: { country, isBlocked, isHighRisk }
    };
  }

  /**
   * Check payment velocity limits
   */
  private async checkVelocityLimits(userId: string): Promise<SecurityCheckResult> {
    const last10Minutes = new Date(Date.now() - 10 * 60 * 1000);

    const recentPayments = await this.paymentModel.countDocuments({
      userId,
      createdAt: { $gte: last10Minutes }
    });

    const tooManyRecent = recentPayments > 3; // Max 3 payments in 10 minutes

    return {
      allowed: !tooManyRecent,
      riskLevel: tooManyRecent ? 'high' : 'low',
      reasons: tooManyRecent ? ['Payment velocity limit exceeded'] : [],
      metadata: { recentPayments, timeWindow: '10 minutes' }
    };
  }

  /**
   * Check payment method risk indicators
   */
  private checkPaymentMethodRisk(paymentMethodDetails?: any): SecurityCheckResult {
    if (!paymentMethodDetails) {
      return {
        allowed: true,
        riskLevel: 'low',
        reasons: []
      };
    }

    const riskFactors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for prepaid cards (higher risk)
    if (paymentMethodDetails.card?.funding === 'prepaid') {
      riskFactors.push('Prepaid card detected');
      riskLevel = 'medium';
    }

    // Check for cards from high-risk countries
    if (paymentMethodDetails.card?.country && this.HIGH_RISK_COUNTRIES.includes(paymentMethodDetails.card.country)) {
      riskFactors.push(`Card issued in high-risk country: ${paymentMethodDetails.card.country}`);
      riskLevel = 'high';
    }

    return {
      allowed: true, // Don't block based on payment method alone
      riskLevel,
      reasons: riskFactors,
      metadata: paymentMethodDetails
    };
  }

  /**
   * Check customer payment history
   */
  private async checkCustomerHistory(userId: string): Promise<SecurityCheckResult> {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalPayments, failedPayments, disputedPayments] = await Promise.all([
      this.paymentModel.countDocuments({ userId, createdAt: { $gte: last30Days } }),
      this.paymentModel.countDocuments({
        userId,
        status: 'failed',
        createdAt: { $gte: last30Days }
      }),
      this.paymentModel.countDocuments({
        userId,
        disputed: true,
        createdAt: { $gte: last30Days }
      })
    ]);

    const riskFactors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (totalPayments > 0) {
      const failureRate = failedPayments / totalPayments;
      const disputeRate = disputedPayments / totalPayments;

      if (failureRate > 0.3) {
        // More than 30% failure rate
        riskFactors.push('High payment failure rate');
        riskLevel = 'high';
      }

      if (disputeRate > 0.1) {
        // More than 10% dispute rate
        riskFactors.push('High chargeback rate');
        riskLevel = 'high';
      }
    }

    return {
      allowed: riskLevel !== 'high',
      riskLevel,
      reasons: riskFactors,
      metadata: { totalPayments, failedPayments, disputedPayments }
    };
  }

  private calculateOverallRiskLevel(checks: SecurityCheckResult[]): 'low' | 'medium' | 'high' | 'critical' {
    const riskLevels = checks.map(check => check.riskLevel);

    if (riskLevels.includes('critical')) return 'critical';
    if (riskLevels.filter(level => level === 'high').length >= 2) return 'critical';
    if (riskLevels.includes('high')) return 'high';
    if (riskLevels.filter(level => level === 'medium').length >= 2) return 'high';
    if (riskLevels.includes('medium')) return 'medium';

    return 'low';
  }

  private normalizeAmount(amount: number, currency: string): number {
    // Simple currency normalization to USD equivalent
    const rates: Record<string, number> = {
      usd: 1,
      eur: 1.1,
      gbp: 1.25,
      cad: 0.75,
      aud: 0.68,
      jpy: 0.0067
    };

    return amount * (rates[currency.toLowerCase()] || 1);
  }

  private assessCountryRisk(country: string): number {
    const countryCode = country.toUpperCase();

    if (this.BLOCKED_COUNTRIES.includes(countryCode)) return 50;
    if (this.HIGH_RISK_COUNTRIES.includes(countryCode)) return 25;

    return 0;
  }

  private assessPaymentMethodRisk(paymentMethodDetails: any): number {
    let risk = 0;

    if (paymentMethodDetails.card?.funding === 'prepaid') risk += 15;
    if (paymentMethodDetails.card?.country && this.HIGH_RISK_COUNTRIES.includes(paymentMethodDetails.card.country)) {
      risk += 20;
    }

    return risk;
  }

  private async assessCustomerHistoryRisk(userId: string): Promise<number> {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalPayments, failedPayments, disputedPayments] = await Promise.all([
      this.paymentModel.countDocuments({ userId, createdAt: { $gte: last30Days } }),
      this.paymentModel.countDocuments({
        userId,
        status: 'failed',
        createdAt: { $gte: last30Days }
      }),
      this.paymentModel.countDocuments({
        userId,
        disputed: true,
        createdAt: { $gte: last30Days }
      })
    ]);

    if (totalPayments === 0) return 0;

    const failureRate = failedPayments / totalPayments;
    const disputeRate = disputedPayments / totalPayments;

    let risk = 0;
    if (failureRate > 0.3) risk += 25;
    if (disputeRate > 0.1) risk += 30;

    return risk;
  }

  private async assessVelocityRisk(userId: string): Promise<number> {
    const last10Minutes = new Date(Date.now() - 10 * 60 * 1000);
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const [recent10Min, recentHour] = await Promise.all([
      this.paymentModel.countDocuments({ userId, createdAt: { $gte: last10Minutes } }),
      this.paymentModel.countDocuments({ userId, createdAt: { $gte: lastHour } })
    ]);

    let risk = 0;
    if (recent10Min > 3) risk += 20;
    if (recentHour > 10) risk += 15;

    return risk;
  }
}
