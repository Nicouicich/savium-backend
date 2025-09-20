import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CardsRepository } from '../cards.repository';
import { CardBalanceEntity } from '../entities/card-balance.entity';
import { CreateCardBalanceDto } from '../dto/card-balance.dto';
import { CardType, BalanceUpdateSource } from '@common/constants/card-types';
import { RequestContextService } from '../../common/services/request-context.service';
import { CardNotFoundException, CardBalanceUpdateException, InvalidBalanceOperationException } from '@common/exceptions/card.exceptions';

@Injectable()
export class CardBalanceService {
  private readonly logger = new Logger(CardBalanceService.name);

  constructor(
    private readonly cardsRepository: CardsRepository,
    private readonly requestContext: RequestContextService
  ) {}

  /**
   * Update card balance from transaction transaction
   */
  async updateFromTransactionTransaction(cardId: string, amount: number, type: 'DEBIT' | 'CREDIT', transactionReference?: string): Promise<CardBalanceEntity> {
    const traceId = this.requestContext.getTraceId();

    try {
      // Get the card to validate it exists and get credit limit
      const card = await this.cardsRepository.findById(cardId);
      if (!card) {
        throw new CardNotFoundException(cardId, traceId);
      }

      // Update balance using atomic operation
      const updatedBalance = await this.cardsRepository.updateBalanceFromTransaction(cardId, amount, type);

      if (!updatedBalance) {
        // Create initial balance if it doesn't exist
        const initialBalance = await this.cardsRepository.upsertBalance(cardId, {
          userId: card.userId,
          currentBalance: type === 'DEBIT' ? amount : -amount,
          isAutomaticUpdate: true,
          updateSource: BalanceUpdateSource.CALCULATED
        });

        await this.updateCalculatedFields(initialBalance, card);
        return initialBalance;
      }

      // Update calculated fields
      await this.updateCalculatedFields(updatedBalance, card);

      this.logger.log(`Card balance updated from ${type} transaction`, {
        cardId,
        amount,
        type,
        newBalance: updatedBalance.currentBalance,
        traceId
      });

      return updatedBalance;
    } catch (error) {
      this.logger.error('Failed to update card balance from transaction', {
        error: error.message,
        cardId,
        amount,
        type,
        traceId
      });

      if (error instanceof CardNotFoundException) {
        throw error;
      }

      throw new CardBalanceUpdateException(cardId, error.message, traceId);
    }
  }

  /**
   * Process payment towards card balance
   */
  async processPayment(cardId: string, paymentAmount: number, paymentDate: Date = new Date(), paymentReference?: string): Promise<CardBalanceEntity> {
    const traceId = this.requestContext.getTraceId();

    if (paymentAmount <= 0) {
      throw new InvalidBalanceOperationException('process payment', 'Payment amount must be positive', cardId, traceId);
    }

    try {
      const balance = await this.cardsRepository.findBalance(cardId);
      if (!balance) {
        throw new CardNotFoundException(cardId, traceId);
      }

      // Calculate new balance after payment
      const newBalance = Math.max(0, balance.currentBalance - paymentAmount);

      // Update balance
      const updatedBalance = await this.cardsRepository.upsertBalance(cardId, {
        currentBalance: newBalance,
        lastUpdated: paymentDate,
        isAutomaticUpdate: false,
        updateSource: BalanceUpdateSource.MANUAL
      });

      // Get card for credit limit calculation
      const card = await this.cardsRepository.findById(cardId);
      if (card) {
        await this.updateCalculatedFields(updatedBalance, card);
      }

      this.logger.log(`Payment processed for card`, {
        cardId,
        paymentAmount,
        previousBalance: balance.currentBalance,
        newBalance: updatedBalance.currentBalance,
        traceId
      });

      return updatedBalance;
    } catch (error) {
      this.logger.error('Failed to process payment', {
        error: error.message,
        cardId,
        paymentAmount,
        traceId
      });

      if (error instanceof CardNotFoundException || error instanceof InvalidBalanceOperationException) {
        throw error;
      }

      throw new CardBalanceUpdateException(cardId, error.message, traceId);
    }
  }

  /**
   * Calculate and update minimum payment for credit cards
   */
  async calculateMinimumPayment(cardId: string): Promise<number> {
    const balance = await this.cardsRepository.findBalance(cardId);
    if (!balance) {
      return 0;
    }

    const card = await this.cardsRepository.findById(cardId);
    if (!card || card.cardType !== CardType.CREDIT) {
      return 0;
    }

    // Standard minimum payment calculation: 2% of balance or $25, whichever is greater
    const percentagePayment = balance.currentBalance * 0.02;
    const minimumPayment = Math.max(percentagePayment, 25);

    // Update the balance record with calculated minimum payment
    await this.cardsRepository.upsertBalance(cardId, {
      minimumPayment
    });

    return minimumPayment;
  }

  /**
   * Calculate credit utilization rate
   */
  async calculateUtilization(cardId: string): Promise<number> {
    const balance = await this.cardsRepository.findBalance(cardId);
    const card = await this.cardsRepository.findById(cardId);

    if (!balance || !card || card.cardType !== CardType.CREDIT || !card.creditLimit) {
      return 0;
    }

    const utilization = (balance.currentBalance / card.creditLimit) * 100;
    return Math.round(utilization * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Check for overdue payments
   */
  async checkOverduePayments(userId: string): Promise<CardBalanceEntity[]> {
    return this.cardsRepository.findOverdueBalances(userId);
  }

  /**
   * Generate payment due notifications
   */
  async getUpcomingPaymentDues(
    userId: string,
    daysAhead: number = 7
  ): Promise<
    {
      cardId: string;
      displayName: string;
      dueDate: Date;
      minimumPayment: number;
      currentBalance: number;
      daysUntilDue: number;
    }[]
  > {
    const cards = await this.cardsRepository.findByUser(userId);
    const balances = await this.cardsRepository.findBalancesByUser(userId);

    const balanceMap = new Map(balances.map(b => [b.cardId.toString(), b]));
    const upcomingDues: any[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    for (const card of cards) {
      const balance = balanceMap.get(card._id!.toString());

      if (balance && balance.paymentDueDate && balance.minimumPayment) {
        const dueDate = new Date(balance.paymentDueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        if (dueDate <= cutoffDate && daysUntilDue >= 0) {
          upcomingDues.push({
            cardId: card._id!.toString(),
            displayName: card.displayName,
            dueDate: balance.paymentDueDate,
            minimumPayment: balance.minimumPayment,
            currentBalance: balance.currentBalance,
            daysUntilDue
          });
        }
      }
    }

    return upcomingDues.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  /**
   * Cron job to calculate interest charges for credit cards
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async calculateDailyInterest(): Promise<void> {
    this.logger.log('Running daily interest calculation...');

    try {
      // This would need access to all cards with balances
      // For now, we'll log that the job ran
      this.logger.log('Daily interest calculation completed');
    } catch (error) {
      this.logger.error('Daily interest calculation failed', error);
    }
  }

  /**
   * Cron job to update overdue status
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async updateOverdueStatus(): Promise<void> {
    this.logger.log('Updating overdue payment status...');

    try {
      // This would iterate through all balances and update overdue status
      // Implementation would depend on specific business rules
      this.logger.log('Overdue status update completed');
    } catch (error) {
      this.logger.error('Overdue status update failed', error);
    }
  }

  /**
   * Update calculated fields like utilization rate and available credit
   */
  private async updateCalculatedFields(balance: CardBalanceEntity, card: any): Promise<void> {
    const updates: any = {};

    // Update utilization rate for credit cards
    if (card.cardType === CardType.CREDIT && card.creditLimit) {
      balance.updateUtilizationRate(card.creditLimit);
      balance.updateAvailableCredit(card.creditLimit);

      updates.utilizationRate = balance.utilizationRate;
      updates.availableCredit = balance.availableCredit;
    }

    // Check overdue status
    balance.checkOverdueStatus();
    updates.isOverdue = balance.isOverdue;
    updates.overdueAmount = balance.overdueAmount;

    // Calculate minimum payment for credit cards
    if (card.cardType === CardType.CREDIT) {
      const percentagePayment = balance.currentBalance * 0.02;
      const minimumPayment = Math.max(percentagePayment, 25);
      updates.minimumPayment = minimumPayment;
    }

    // Update the balance record with calculated fields
    if (Object.keys(updates).length > 0) {
      await this.cardsRepository.upsertBalance(card._id.toString(), updates);
    }
  }

  /**
   * Get balance history for a card
   */
  async getBalanceHistory(cardId: string, startDate?: Date, endDate?: Date): Promise<CardBalanceEntity[]> {
    // For now, we only store current balance
    // In a full implementation, we'd store historical balance records
    const currentBalance = await this.cardsRepository.findBalance(cardId);
    return currentBalance ? [currentBalance] : [];
  }

  /**
   * Calculate total debt across all cards for a user
   */
  async calculateTotalDebt(userId: string): Promise<{
    totalBalance: number;
    totalMinimumPayment: number;
    totalAvailableCredit: number;
    averageUtilization: number;
    overdueAmount: number;
  }> {
    const balances = await this.cardsRepository.findBalancesByUser(userId);

    let totalBalance = 0;
    let totalMinimumPayment = 0;
    let totalAvailableCredit = 0;
    let totalUtilization = 0;
    let overdueAmount = 0;
    let creditCards = 0;

    for (const balance of balances) {
      totalBalance += balance.currentBalance;
      totalMinimumPayment += balance.minimumPayment || 0;
      totalAvailableCredit += balance.availableCredit || 0;

      if (balance.utilizationRate !== undefined) {
        totalUtilization += balance.utilizationRate;
        creditCards++;
      }

      if (balance.isOverdue) {
        overdueAmount += balance.overdueAmount || 0;
      }
    }

    const averageUtilization = creditCards > 0 ? totalUtilization / creditCards : 0;

    return {
      totalBalance,
      totalMinimumPayment,
      totalAvailableCredit,
      averageUtilization,
      overdueAmount
    };
  }
}
