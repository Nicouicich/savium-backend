import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { CardAnalyticsService } from './card-analytics.service';
import { CardsRepository } from '../cards.repository';
import { StatsPeriod } from '@common/constants/card-types';
import { CardEntity } from '../entities/card.entity';
import { CardBalanceEntity } from '../entities/card-balance.entity';

describe('CardAnalyticsService', () => {
  let service: CardAnalyticsService;
  let cardsRepository: jest.Mocked<CardsRepository>;
  let connection: jest.Mocked<Connection>;

  const mockCard = new CardEntity({
    _id: '507f1f77bcf86cd799439011' as any,
    userId: 'user-123',
    accountId: '507f1f77bcf86cd799439012' as any,
    displayName: 'Test Credit Card',
    cardType: 'CREDIT',
    creditLimit: 5000,
    status: 'ACTIVE',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const mockBalance = new CardBalanceEntity({
    _id: '507f1f77bcf86cd799439013' as any,
    cardId: '507f1f77bcf86cd799439011' as any,
    userId: 'user-123',
    currentBalance: 1500,
    availableCredit: 3500,
    utilizationRate: 30,
    minimumPayment: 75,
    paymentDueDate: new Date('2024-02-15'),
    lastUpdated: new Date()
  });

  beforeEach(async () => {
    const mockDatabase = {
      collection: jest.fn()
    };

    const mockCollection = {
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn()
      })
    };

    const mockConnection = {
      db: mockDatabase
    };

    mockDatabase.collection.mockReturnValue(mockCollection);

    const mockCardsRepository = {
      findById: jest.fn(),
      findBalance: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardAnalyticsService,
        {
          provide: CardsRepository,
          useValue: mockCardsRepository
        },
        {
          provide: getConnectionToken(),
          useValue: mockConnection
        }
      ]
    }).compile();

    service = module.get<CardAnalyticsService>(CardAnalyticsService);
    cardsRepository = module.get(CardsRepository);
    connection = module.get(getConnectionToken());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCardStatistics', () => {
    it('should return comprehensive card statistics', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      cardsRepository.findById.mockResolvedValue(mockCard);
      cardsRepository.findBalance.mockResolvedValue(mockBalance);

      // Mock aggregation results
      const mockTransactionStats = [
        {
          totalSpent: 2500,
          totalTransactions: 25
        }
      ];

      const mockCategoryBreakdown = [
        {
          _id: 'cat-1',
          categoryName: 'Food & Dining',
          amount: 800,
          transactionCount: 10
        },
        {
          _id: 'cat-2',
          categoryName: 'Transportation',
          amount: 600,
          transactionCount: 8
        }
      ];

      const mockMonthlySpending = [
        {
          _id: { year: 2024, month: 1 },
          amount: 2500,
          transactionCount: 25
        }
      ];

      const mockTopMerchants = [
        {
          _id: 'Starbucks',
          amount: 150,
          transactionCount: 15,
          lastTransaction: new Date('2024-01-30')
        }
      ];

      // Setup collection mock to return different results based on pipeline
      const mockCollection = connection.db.collection();
      mockCollection
        .aggregate()
        .toArray.mockResolvedValueOnce(mockTransactionStats)
        .mockResolvedValueOnce(mockCategoryBreakdown)
        .mockResolvedValueOnce(mockMonthlySpending)
        .mockResolvedValueOnce(mockTopMerchants);

      // Act
      const result = await service.getCardStatistics('507f1f77bcf86cd799439011', StatsPeriod.MONTH, startDate, endDate);

      // Assert
      expect(result).toEqual({
        cardId: mockCard._id,
        period: { start: startDate, end: endDate },
        totalSpent: 2500,
        totalTransactions: 25,
        averageTransaction: 100, // 2500 / 25
        currentBalance: 1500,
        availableCredit: 3500,
        utilizationRate: 30,
        categoryBreakdown: [
          {
            categoryId: 'cat-1',
            categoryName: 'Food & Dining',
            amount: 800,
            percentage: 32, // 800 / 2500 * 100
            transactionCount: 10
          },
          {
            categoryId: 'cat-2',
            categoryName: 'Transportation',
            amount: 600,
            percentage: 24, // 600 / 2500 * 100
            transactionCount: 8
          }
        ],
        monthlySpending: [
          {
            month: 'January',
            year: 2024,
            amount: 2500,
            transactionCount: 25
          }
        ],
        topMerchants: [
          {
            merchant: 'Starbucks',
            amount: 150,
            transactionCount: 15,
            lastTransaction: new Date('2024-01-30')
          }
        ],
        paymentDue: mockBalance.paymentDueDate,
        minimumPayment: 75
      });
    });

    it('should throw error when card not found', async () => {
      // Arrange
      cardsRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getCardStatistics('invalid-card-id')).rejects.toThrow('Card invalid-card-id not found');
    });

    it('should handle missing balance gracefully', async () => {
      // Arrange
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardsRepository.findBalance.mockResolvedValue(null);

      // Mock empty aggregation results
      const mockCollection = connection.db.collection();
      mockCollection
        .aggregate()
        .toArray.mockResolvedValue([{ totalSpent: 0, totalTransactions: 0 }])
        .mockResolvedValue([])
        .mockResolvedValue([])
        .mockResolvedValue([]);

      // Act
      const result = await service.getCardStatistics('507f1f77bcf86cd799439011');

      // Assert
      expect(result.currentBalance).toBe(0);
      expect(result.availableCredit).toBeUndefined();
      expect(result.utilizationRate).toBeUndefined();
    });
  });

  describe('getSpendingComparison', () => {
    it('should calculate spending comparison between periods', async () => {
      // Arrange
      const currentPeriod = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
      const previousPeriod = { start: new Date('2023-12-01'), end: new Date('2023-12-31') };

      const mockCollection = connection.db.collection();
      mockCollection
        .aggregate()
        .toArray.mockResolvedValueOnce([{ totalSpent: 2500, totalTransactions: 25 }]) // Current
        .mockResolvedValueOnce([{ totalSpent: 2000, totalTransactions: 20 }]); // Previous

      // Act
      const result = await service.getSpendingComparison('507f1f77bcf86cd799439011', currentPeriod, previousPeriod);

      // Assert
      expect(result).toEqual({
        currentSpending: 2500,
        previousSpending: 2000,
        percentageChange: 25, // (2500 - 2000) / 2000 * 100
        trend: 'up'
      });
    });

    it('should handle downward trend', async () => {
      // Arrange
      const currentPeriod = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
      const previousPeriod = { start: new Date('2023-12-01'), end: new Date('2023-12-31') };

      const mockCollection = connection.db.collection();
      mockCollection
        .aggregate()
        .toArray.mockResolvedValueOnce([{ totalSpent: 1500, totalTransactions: 15 }]) // Current
        .mockResolvedValueOnce([{ totalSpent: 2000, totalTransactions: 20 }]); // Previous

      // Act
      const result = await service.getSpendingComparison('507f1f77bcf86cd799439011', currentPeriod, previousPeriod);

      // Assert
      expect(result.trend).toBe('down');
      expect(result.percentageChange).toBe(-25);
    });

    it('should handle stable trend', async () => {
      // Arrange
      const currentPeriod = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
      const previousPeriod = { start: new Date('2023-12-01'), end: new Date('2023-12-31') };

      const mockCollection = connection.db.collection();
      mockCollection
        .aggregate()
        .toArray.mockResolvedValueOnce([{ totalSpent: 2000, totalTransactions: 20 }]) // Current
        .mockResolvedValueOnce([{ totalSpent: 1950, totalTransactions: 19 }]); // Previous

      // Act
      const result = await service.getSpendingComparison('507f1f77bcf86cd799439011', currentPeriod, previousPeriod);

      // Assert
      expect(result.trend).toBe('stable'); // Less than 5% change
      expect(Math.abs(result.percentageChange)).toBeLessThan(5);
    });

    it('should handle zero previous spending', async () => {
      // Arrange
      const currentPeriod = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
      const previousPeriod = { start: new Date('2023-12-01'), end: new Date('2023-12-31') };

      const mockCollection = connection.db.collection();
      mockCollection
        .aggregate()
        .toArray.mockResolvedValueOnce([{ totalSpent: 1000, totalTransactions: 10 }]) // Current
        .mockResolvedValueOnce([{ totalSpent: 0, totalTransactions: 0 }]); // Previous

      // Act
      const result = await service.getSpendingComparison('507f1f77bcf86cd799439011', currentPeriod, previousPeriod);

      // Assert
      expect(result.percentageChange).toBe(0);
      expect(result.previousSpending).toBe(0);
    });
  });

  describe('getSpendingByDayOfWeek', () => {
    it('should return spending patterns by day of week', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockResults = [
        { _id: 1, amount: 300, transactionCount: 3 }, // Sunday
        { _id: 2, amount: 500, transactionCount: 5 }, // Monday
        { _id: 6, amount: 800, transactionCount: 8 } // Friday
      ];

      const mockCollection = connection.db.collection();
      mockCollection.aggregate().toArray.mockResolvedValue(mockResults);

      // Act
      const result = await service.getSpendingByDayOfWeek('507f1f77bcf86cd799439011', startDate, endDate);

      // Assert
      expect(result).toEqual([
        {
          dayOfWeek: 1,
          dayName: 'Sunday',
          amount: 300,
          transactionCount: 3
        },
        {
          dayOfWeek: 2,
          dayName: 'Monday',
          amount: 500,
          transactionCount: 5
        },
        {
          dayOfWeek: 6,
          dayName: 'Friday',
          amount: 800,
          transactionCount: 8
        }
      ]);

      expect(connection.db.collection).toHaveBeenCalledWith('transactions');
    });
  });

  describe('getSpendingByTimeOfDay', () => {
    it('should return spending patterns by hour', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockResults = [
        { _id: 8, amount: 150, transactionCount: 5 }, // 8 AM
        { _id: 12, amount: 800, transactionCount: 15 }, // 12 PM
        { _id: 18, amount: 600, transactionCount: 10 } // 6 PM
      ];

      const mockCollection = connection.db.collection();
      mockCollection.aggregate().toArray.mockResolvedValue(mockResults);

      // Act
      const result = await service.getSpendingByTimeOfDay('507f1f77bcf86cd799439011', startDate, endDate);

      // Assert
      expect(result).toEqual([
        { hour: 8, amount: 150, transactionCount: 5 },
        { hour: 12, amount: 800, transactionCount: 15 },
        { hour: 18, amount: 600, transactionCount: 10 }
      ]);
    });
  });

  describe('getUtilizationTrend', () => {
    it('should return current utilization when data available', async () => {
      // Arrange
      cardsRepository.findBalance.mockResolvedValue(mockBalance);
      cardsRepository.findById.mockResolvedValue(mockCard);

      // Act
      const result = await service.getUtilizationTrend('507f1f77bcf86cd799439011', 6);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        month: expect.any(String),
        year: expect.any(Number),
        utilization: 30, // 1500 / 5000 * 100
        balance: 1500
      });
    });

    it('should return empty array when no balance or credit limit', async () => {
      // Arrange
      cardsRepository.findBalance.mockResolvedValue(null);
      cardsRepository.findById.mockResolvedValue(mockCard);

      // Act
      const result = await service.getUtilizationTrend('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toEqual([]);
    });

    it('should return empty array when no credit limit', async () => {
      // Arrange
      const cardWithoutLimit = { ...mockCard, creditLimit: undefined };
      cardsRepository.findBalance.mockResolvedValue(mockBalance);
      cardsRepository.findById.mockResolvedValue(cardWithoutLimit);

      // Act
      const result = await service.getUtilizationTrend('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('calculatePeriodDates', () => {
    beforeEach(() => {
      // Mock Date.now() to return a fixed date for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should use custom dates when provided', () => {
      // Arrange
      const customStart = new Date('2024-01-01');
      const customEnd = new Date('2024-01-31');

      // Act
      const result = (service as any).calculatePeriodDates(StatsPeriod.MONTH, customStart, customEnd);

      // Assert
      expect(result.startDate).toEqual(customStart);
      expect(result.endDate).toEqual(customEnd);
    });

    it('should calculate week period correctly', () => {
      // Act
      const result = (service as any).calculatePeriodDates(StatsPeriod.WEEK);

      // Assert
      const expectedStart = new Date('2024-01-08T12:00:00Z'); // 7 days before
      expect(result.startDate.toISOString()).toBe(expectedStart.toISOString());
    });

    it('should calculate month period correctly', () => {
      // Act
      const result = (service as any).calculatePeriodDates(StatsPeriod.MONTH);

      // Assert
      const expectedStart = new Date('2023-12-15T12:00:00Z'); // 1 month before
      expect(result.startDate.toISOString()).toBe(expectedStart.toISOString());
    });

    it('should calculate quarter period correctly', () => {
      // Act
      const result = (service as any).calculatePeriodDates(StatsPeriod.QUARTER);

      // Assert
      const expectedStart = new Date('2023-10-15T12:00:00Z'); // 3 months before
      expect(result.startDate.toISOString()).toBe(expectedStart.toISOString());
    });

    it('should calculate year period correctly', () => {
      // Act
      const result = (service as any).calculatePeriodDates(StatsPeriod.YEAR);

      // Assert
      const expectedStart = new Date('2023-01-15T12:00:00Z'); // 1 year before
      expect(result.startDate.toISOString()).toBe(expectedStart.toISOString());
    });

    it('should default to month for unknown period', () => {
      // Act
      const result = (service as any).calculatePeriodDates('UNKNOWN_PERIOD' as StatsPeriod);

      // Assert
      const expectedStart = new Date('2023-12-15T12:00:00Z'); // 1 month before (default)
      expect(result.startDate.toISOString()).toBe(expectedStart.toISOString());
    });
  });
});
