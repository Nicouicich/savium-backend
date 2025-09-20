import { StatsPeriod } from '@common/constants/card-types';
import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { CardsRepository } from '../cards.repository';
import { ICardStatistics, ICategorySpending, IMerchantSpending, IMonthlySpending } from '../interfaces/card.interface';

@Injectable()
export class CardAnalyticsService {
  private readonly logger = new Logger(CardAnalyticsService.name);

  constructor(
    private readonly cardsRepository: CardsRepository,
    @InjectConnection() private readonly connection: Connection
  ) {}

  /**
   * Generate comprehensive card statistics
   */
  async getCardStatistics(cardId: string, period: StatsPeriod = StatsPeriod.MONTH, customStartDate?: Date, customEndDate?: Date): Promise<ICardStatistics> {
    const { startDate, endDate } = this.calculatePeriodDates(period, customStartDate, customEndDate);

    // Get card information
    const card = await this.cardsRepository.findById(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not found`);
    }

    // Get card balance
    const balance = await this.cardsRepository.findBalance(cardId);

    // Get transaction statistics using aggregation
    const transactionStats = await this.getTransactionStatistics(cardId, startDate, endDate);

    // Get category breakdown
    const categoryBreakdown = await this.getCategoryBreakdown(cardId, startDate, endDate);

    // Get monthly spending pattern
    const monthlySpending = await this.getMonthlySpending(cardId, startDate, endDate);

    // Get top merchants
    const topMerchants = await this.getTopMerchants(cardId, startDate, endDate);

    return {
      cardId: card._id!,
      period: { start: startDate, end: endDate },
      totalSpent: transactionStats.totalSpent,
      totalTransactions: transactionStats.totalTransactions,
      averageTransaction: transactionStats.averageTransaction,
      currentBalance: balance?.currentBalance || 0,
      availableCredit: balance?.availableCredit,
      utilizationRate: balance?.utilizationRate,
      categoryBreakdown,
      monthlySpending,
      topMerchants,
      paymentDue: balance?.paymentDueDate,
      minimumPayment: balance?.minimumPayment
    };
  }

  /**
   * Get spending comparison between periods
   */
  async getSpendingComparison(
    cardId: string,
    currentPeriod: { start: Date; end: Date },
    previousPeriod: { start: Date; end: Date }
  ): Promise<{
    currentSpending: number;
    previousSpending: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'stable';
  }> {
    const [currentStats, previousStats] = await Promise.all([
      this.getTransactionStatistics(cardId, currentPeriod.start, currentPeriod.end),
      this.getTransactionStatistics(cardId, previousPeriod.start, previousPeriod.end)
    ]);

    const percentageChange = previousStats.totalSpent > 0 ? ((currentStats.totalSpent - previousStats.totalSpent) / previousStats.totalSpent) * 100 : 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(percentageChange) > 5) {
      trend = percentageChange > 0 ? 'up' : 'down';
    }

    return {
      currentSpending: currentStats.totalSpent,
      previousSpending: previousStats.totalSpent,
      percentageChange: Math.round(percentageChange * 100) / 100,
      trend
    };
  }

  /**
   * Get spending patterns by day of week
   */
  async getSpendingByDayOfWeek(
    cardId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ dayOfWeek: number; dayName: string; amount: number; transactionCount: number }>> {
    const db = this.connection.db;
    if (!db) throw new Error('Database connection not available');

    const pipeline = [
      {
        $match: {
          cardId: { $oid: cardId },
          date: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$date' },
          amount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ];

    const results = await db.collection('transactions').aggregate(pipeline).toArray();

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return results.map(result => ({
      dayOfWeek: result._id,
      dayName: dayNames[result._id - 1],
      amount: result.amount,
      transactionCount: result.transactionCount
    }));
  }

  /**
   * Get spending patterns by time of day
   */
  async getSpendingByTimeOfDay(cardId: string, startDate: Date, endDate: Date): Promise<Array<{ hour: number; amount: number; transactionCount: number }>> {
    const db = this.connection.db;
    if (!db) throw new Error('Database connection not available');

    const pipeline = [
      {
        $match: {
          cardId: { $oid: cardId },
          date: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: { $hour: '$date' },
          amount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ];

    const results = await db.collection('transactions').aggregate(pipeline).toArray();

    return results.map(result => ({
      hour: result._id,
      amount: result.amount,
      transactionCount: result.transactionCount
    }));
  }

  /**
   * Get card utilization trend over time
   */
  async getUtilizationTrend(cardId: string, months: number = 12): Promise<Array<{ month: string; year: number; utilization: number; balance: number }>> {
    // For now, return current utilization
    // In a full implementation, we'd store historical balance data
    const balance = await this.cardsRepository.findBalance(cardId);
    const card = await this.cardsRepository.findById(cardId);

    if (!balance || !card || !card.creditLimit) {
      return [];
    }

    const currentUtilization = (balance.currentBalance / card.creditLimit) * 100;
    const now = new Date();

    return [
      {
        month: now.toLocaleString('default', { month: 'long' }),
        year: now.getFullYear(),
        utilization: Math.round(currentUtilization * 100) / 100,
        balance: balance.currentBalance
      }
    ];
  }

  /**
   * Get transaction statistics for a period
   */
  private async getTransactionStatistics(
    cardId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ totalSpent: number; totalTransactions: number; averageTransaction: number }> {
    const db = this.connection.db;
    if (!db) throw new Error('Database connection not available');

    const pipeline = [
      {
        $match: {
          cardId: { $oid: cardId },
          date: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
          totalTransactions: { $sum: 1 }
        }
      }
    ];

    const results = await db.collection('transactions').aggregate(pipeline).toArray();
    const stats = results[0] || { totalSpent: 0, totalTransactions: 0 };

    return {
      totalSpent: stats.totalSpent,
      totalTransactions: stats.totalTransactions,
      averageTransaction: stats.totalTransactions > 0 ? stats.totalSpent / stats.totalTransactions : 0
    };
  }

  /**
   * Get category breakdown for transactions
   */
  private async getCategoryBreakdown(cardId: string, startDate: Date, endDate: Date): Promise<ICategorySpending[]> {
    const db = this.connection.db;
    if (!db) throw new Error('Database connection not available');

    const pipeline = [
      {
        $match: {
          cardId: { $oid: cardId },
          date: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: '$category'
      },
      {
        $group: {
          _id: '$categoryId',
          categoryName: { $first: '$category.name' },
          amount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { amount: -1 }
      }
    ];

    const results = await db.collection('transactions').aggregate(pipeline).toArray();
    const totalSpent = results.reduce((sum, cat) => sum + cat.amount, 0);

    return results.map(result => ({
      categoryId: result._id,
      categoryName: result.categoryName,
      amount: result.amount,
      percentage: totalSpent > 0 ? (result.amount / totalSpent) * 100 : 0,
      transactionCount: result.transactionCount
    }));
  }

  /**
   * Get monthly spending pattern
   */
  private async getMonthlySpending(cardId: string, startDate: Date, endDate: Date): Promise<IMonthlySpending[]> {
    const db = this.connection.db;
    if (!db) throw new Error('Database connection not available');

    const pipeline = [
      {
        $match: {
          cardId: { $oid: cardId },
          date: { $gte: startDate, $lte: endDate },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          amount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ];

    const results = await db.collection('transactions').aggregate(pipeline).toArray();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return results.map(result => ({
      month: monthNames[result._id.month - 1],
      year: result._id.year,
      amount: result.amount,
      transactionCount: result.transactionCount
    }));
  }

  /**
   * Get top merchants by spending
   */
  private async getTopMerchants(cardId: string, startDate: Date, endDate: Date, limit: number = 10): Promise<IMerchantSpending[]> {
    const db = this.connection.db;
    if (!db) throw new Error('Database connection not available');

    const pipeline = [
      {
        $match: {
          cardId: { $oid: cardId },
          date: { $gte: startDate, $lte: endDate },
          vendor: { $exists: true, $nin: [null, ''] },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$vendor',
          amount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          lastTransaction: { $max: '$date' }
        }
      },
      {
        $sort: { amount: -1 }
      },
      {
        $limit: limit
      }
    ];

    const results = await db.collection('transactions').aggregate(pipeline).toArray();

    return results.map(result => ({
      merchant: result._id,
      amount: result.amount,
      transactionCount: result.transactionCount,
      lastTransaction: result.lastTransaction
    }));
  }

  /**
   * Calculate period dates based on StatsPeriod enum
   */
  private calculatePeriodDates(period: StatsPeriod, customStartDate?: Date, customEndDate?: Date): { startDate: Date; endDate: Date } {
    if (customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate };
    }

    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();

    switch (period) {
      case StatsPeriod.WEEK:
        startDate.setDate(now.getDate() - 7);
        break;
      case StatsPeriod.MONTH:
        startDate.setMonth(now.getMonth() - 1);
        break;
      case StatsPeriod.QUARTER:
        startDate.setMonth(now.getMonth() - 3);
        break;
      case StatsPeriod.YEAR:
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    return { startDate, endDate };
  }
}
