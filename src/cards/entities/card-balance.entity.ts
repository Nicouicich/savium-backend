import { Types } from 'mongoose';
import { ICardBalance } from '../interfaces/card.interface';
import { BalanceUpdateSource } from '@common/constants/card-types';

export class CardBalanceEntity implements ICardBalance {
  _id?: Types.ObjectId;
  cardId: Types.ObjectId;
  userId: string;
  currentBalance: number;
  availableCredit?: number;
  minimumPayment?: number;
  paymentDueDate?: Date;
  currency: string;
  statementStartDate?: Date;
  statementEndDate?: Date;
  statementBalance?: number;
  lastUpdated: Date;
  isAutomaticUpdate: boolean;
  updateSource: string;
  utilizationRate?: number;
  isOverdue: boolean;
  overdueAmount?: number;
  lateFees?: number;
  interestCharges?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<ICardBalance>) {
    Object.assign(this, data);
    this.lastUpdated = this.lastUpdated || new Date();
    this.isAutomaticUpdate = this.isAutomaticUpdate ?? false;
    this.updateSource = this.updateSource || BalanceUpdateSource.MANUAL;
    this.isOverdue = this.isOverdue ?? false;
    this.currentBalance = this.currentBalance || 0;
  }

  /**
   * Calculate utilization rate if credit limit is available
   */
  calculateUtilizationRate(creditLimit?: number): number {
    if (!creditLimit || creditLimit <= 0) {
      return 0;
    }

    const utilization = (this.currentBalance / creditLimit) * 100;
    return Math.round(utilization * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Update utilization rate based on current balance and credit limit
   */
  updateUtilizationRate(creditLimit?: number): void {
    this.utilizationRate = this.calculateUtilizationRate(creditLimit);
  }

  /**
   * Check if payment is overdue
   */
  checkOverdueStatus(): void {
    if (!this.paymentDueDate) {
      this.isOverdue = false;
      this.overdueAmount = 0;
      return;
    }

    const now = new Date();
    this.isOverdue = now > this.paymentDueDate && this.currentBalance > 0;

    if (this.isOverdue) {
      this.overdueAmount = this.minimumPayment || this.currentBalance;
    } else {
      this.overdueAmount = 0;
    }
  }

  /**
   * Calculate days until payment due
   */
  getDaysUntilDue(): number {
    if (!this.paymentDueDate) {
      return 0;
    }

    const now = new Date();
    const diffTime = this.paymentDueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Calculate available credit for credit cards
   */
  calculateAvailableCredit(creditLimit?: number): number {
    if (!creditLimit || creditLimit <= 0) {
      return 0;
    }

    return Math.max(0, creditLimit - this.currentBalance);
  }

  /**
   * Update available credit based on current balance and credit limit
   */
  updateAvailableCredit(creditLimit?: number): void {
    this.availableCredit = this.calculateAvailableCredit(creditLimit);
  }

  /**
   * Check if the balance is in a healthy state (under 30% utilization for credit cards)
   */
  isHealthy(creditLimit?: number): boolean {
    if (!creditLimit) {
      return true; // For non-credit cards or cards without limit
    }

    const utilization = this.calculateUtilizationRate(creditLimit);
    return utilization <= 30 && !this.isOverdue;
  }

  /**
   * Get balance summary for display
   */
  getSummary(): {
    currentBalance: number;
    availableCredit?: number;
    utilizationRate?: number;
    daysUntilDue?: number;
    isOverdue: boolean;
    isHealthy: boolean;
  } {
    return {
      currentBalance: this.currentBalance,
      availableCredit: this.availableCredit,
      utilizationRate: this.utilizationRate,
      daysUntilDue: this.getDaysUntilDue(),
      isOverdue: this.isOverdue,
      isHealthy: this.isHealthy()
    };
  }
}
