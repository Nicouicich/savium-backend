import { Test, TestingModule } from '@nestjs/testing';
import { CardBalanceService } from './card-balance.service';
import { CardsRepository } from '../cards.repository';
import { RequestContextService } from '@common/services/request-context.service';
import { CardBalanceEntity } from '../entities/card-balance.entity';
import { CardEntity } from '../entities/card.entity';
import { CardType, BalanceUpdateSource } from '@common/constants/card-types';
import { CardNotFoundException, CardBalanceUpdateException, InvalidBalanceOperationException } from '@common/exceptions/card.exceptions';

describe('CardBalanceService', () => {
  let service: CardBalanceService;
  let cardsRepository: jest.Mocked<CardsRepository>;
  let requestContext: jest.Mocked<RequestContextService>;

  const mockCard = new CardEntity({
    _id: '507f1f77bcf86cd799439011' as any,
    userId: 'user-123',
    accountId: '507f1f77bcf86cd799439012' as any,
    displayName: 'Test Credit Card',
    cardType: CardType.CREDIT,
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
    isAutomaticUpdate: false,
    updateSource: BalanceUpdateSource.CALCULATED,
    lastUpdated: new Date()
  });

  beforeEach(async () => {
    const mockCardsRepository = {
      findById: jest.fn(),
      findBalance: jest.fn(),
      updateBalanceFromTransaction: jest.fn(),
      upsertBalance: jest.fn(),
      findOverdueBalances: jest.fn(),
      findByUser: jest.fn(),
      findBalancesByUser: jest.fn()
    };

    const mockRequestContext = {
      getTraceId: jest.fn().mockReturnValue('trace-123'),
      getUserId: jest.fn().mockReturnValue('user-123')
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardBalanceService,
        {
          provide: CardsRepository,
          useValue: mockCardsRepository
        },
        {
          provide: RequestContextService,
          useValue: mockRequestContext
        }
      ]
    }).compile();

    service = module.get<CardBalanceService>(CardBalanceService);
    cardsRepository = module.get(CardsRepository);
    requestContext = module.get(RequestContextService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateFromTransactionTransaction', () => {
    it('should update balance from debit transaction', async () => {
      // Arrange
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardsRepository.updateBalanceFromTransaction.mockResolvedValue(mockBalance);
      cardsRepository.upsertBalance.mockResolvedValue(mockBalance);

      // Act
      const result = await service.updateFromTransactionTransaction('507f1f77bcf86cd799439011', 100, 'DEBIT', 'txn-123');

      // Assert
      expect(result).toBeDefined();
      expect(cardsRepository.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(cardsRepository.updateBalanceFromTransaction).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 100, 'DEBIT');
    });

    it('should create initial balance if none exists', async () => {
      // Arrange
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardsRepository.updateBalanceFromTransaction.mockResolvedValue(null);
      cardsRepository.upsertBalance.mockResolvedValue(mockBalance);

      // Act
      const result = await service.updateFromTransactionTransaction('507f1f77bcf86cd799439011', 100, 'DEBIT');

      // Assert
      expect(cardsRepository.upsertBalance).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({
          userId: 'user-123',
          currentBalance: 100,
          isAutomaticUpdate: true,
          updateSource: BalanceUpdateSource.CALCULATED
        })
      );
      expect(result).toBeDefined();
    });

    it('should handle credit transactions correctly', async () => {
      // Arrange
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardsRepository.updateBalanceFromTransaction.mockResolvedValue(null);
      cardsRepository.upsertBalance.mockResolvedValue(mockBalance);

      // Act
      const result = await service.updateFromTransactionTransaction('507f1f77bcf86cd799439011', 100, 'CREDIT');

      // Assert
      expect(cardsRepository.upsertBalance).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({
          currentBalance: -100 // Credit reduces balance
        })
      );
    });

    it('should throw CardNotFoundException when card does not exist', async () => {
      // Arrange
      cardsRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateFromTransactionTransaction('507f1f77bcf86cd799439011', 100, 'DEBIT')).rejects.toThrow(CardNotFoundException);
    });

    it('should throw CardBalanceUpdateException on repository failure', async () => {
      // Arrange
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardsRepository.updateBalanceFromTransaction.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.updateFromTransactionTransaction('507f1f77bcf86cd799439011', 100, 'DEBIT')).rejects.toThrow(CardBalanceUpdateException);
    });
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      // Arrange
      const paymentAmount = 500;
      const originalBalance = { ...mockBalance, currentBalance: 1500 };
      const updatedBalance = { ...mockBalance, currentBalance: 1000 };

      cardsRepository.findBalance.mockResolvedValue(originalBalance);
      cardsRepository.upsertBalance.mockResolvedValue(updatedBalance);
      cardsRepository.findById.mockResolvedValue(mockCard);

      // Act
      const result = await service.processPayment('507f1f77bcf86cd799439011', paymentAmount, new Date(), 'payment-123');

      // Assert
      expect(result.currentBalance).toBe(1000);
      expect(cardsRepository.upsertBalance).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({
          currentBalance: 1000,
          isAutomaticUpdate: false,
          updateSource: BalanceUpdateSource.MANUAL
        })
      );
    });

    it('should not allow negative balance after payment', async () => {
      // Arrange
      const paymentAmount = 2000; // More than current balance
      const originalBalance = { ...mockBalance, currentBalance: 1500 };
      const updatedBalance = { ...mockBalance, currentBalance: 0 };

      cardsRepository.findBalance.mockResolvedValue(originalBalance);
      cardsRepository.upsertBalance.mockResolvedValue(updatedBalance);
      cardsRepository.findById.mockResolvedValue(mockCard);

      // Act
      const result = await service.processPayment('507f1f77bcf86cd799439011', paymentAmount);

      // Assert
      expect(result.currentBalance).toBe(0);
      expect(cardsRepository.upsertBalance).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({
          currentBalance: 0
        })
      );
    });

    it('should throw InvalidBalanceOperationException for negative payment amount', async () => {
      // Act & Assert
      await expect(service.processPayment('507f1f77bcf86cd799439011', -100)).rejects.toThrow(InvalidBalanceOperationException);
    });

    it('should throw InvalidBalanceOperationException for zero payment amount', async () => {
      // Act & Assert
      await expect(service.processPayment('507f1f77bcf86cd799439011', 0)).rejects.toThrow(InvalidBalanceOperationException);
    });

    it('should throw CardNotFoundException when balance not found', async () => {
      // Arrange
      cardsRepository.findBalance.mockResolvedValue(null);

      // Act & Assert
      await expect(service.processPayment('507f1f77bcf86cd799439011', 100)).rejects.toThrow(CardNotFoundException);
    });
  });

  describe('calculateMinimumPayment', () => {
    it('should calculate minimum payment for credit card', async () => {
      // Arrange
      const creditCard = { ...mockCard, cardType: CardType.CREDIT };
      const balance = { ...mockBalance, currentBalance: 1000 };

      cardsRepository.findBalance.mockResolvedValue(balance);
      cardsRepository.findById.mockResolvedValue(creditCard);
      cardsRepository.upsertBalance.mockResolvedValue(balance);

      // Act
      const result = await service.calculateMinimumPayment('507f1f77bcf86cd799439011');

      // Assert
      // 2% of 1000 = 20, but minimum is 25
      expect(result).toBe(25);
      expect(cardsRepository.upsertBalance).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({
          minimumPayment: 25
        })
      );
    });

    it('should calculate percentage-based minimum payment for large balances', async () => {
      // Arrange
      const creditCard = { ...mockCard, cardType: CardType.CREDIT };
      const balance = { ...mockBalance, currentBalance: 5000 };

      cardsRepository.findBalance.mockResolvedValue(balance);
      cardsRepository.findById.mockResolvedValue(creditCard);
      cardsRepository.upsertBalance.mockResolvedValue(balance);

      // Act
      const result = await service.calculateMinimumPayment('507f1f77bcf86cd799439011');

      // Assert
      // 2% of 5000 = 100, which is greater than minimum 25
      expect(result).toBe(100);
    });

    it('should return 0 for non-credit cards', async () => {
      // Arrange
      const debitCard = { ...mockCard, cardType: CardType.DEBIT };
      const balance = { ...mockBalance, currentBalance: 1000 };

      cardsRepository.findBalance.mockResolvedValue(balance);
      cardsRepository.findById.mockResolvedValue(debitCard);

      // Act
      const result = await service.calculateMinimumPayment('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when balance not found', async () => {
      // Arrange
      cardsRepository.findBalance.mockResolvedValue(null);

      // Act
      const result = await service.calculateMinimumPayment('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('calculateUtilization', () => {
    it('should calculate correct utilization rate', async () => {
      // Arrange
      const creditCard = { ...mockCard, cardType: CardType.CREDIT, creditLimit: 5000 };
      const balance = { ...mockBalance, currentBalance: 1500 };

      cardsRepository.findBalance.mockResolvedValue(balance);
      cardsRepository.findById.mockResolvedValue(creditCard);

      // Act
      const result = await service.calculateUtilization('507f1f77bcf86cd799439011');

      // Assert
      // 1500 / 5000 * 100 = 30%
      expect(result).toBe(30);
    });

    it('should return 0 for non-credit cards', async () => {
      // Arrange
      const debitCard = { ...mockCard, cardType: CardType.DEBIT };
      const balance = { ...mockBalance, currentBalance: 1000 };

      cardsRepository.findBalance.mockResolvedValue(balance);
      cardsRepository.findById.mockResolvedValue(debitCard);

      // Act
      const result = await service.calculateUtilization('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when no credit limit', async () => {
      // Arrange
      const cardWithoutLimit = { ...mockCard, creditLimit: undefined };
      const balance = { ...mockBalance, currentBalance: 1000 };

      cardsRepository.findBalance.mockResolvedValue(balance);
      cardsRepository.findById.mockResolvedValue(cardWithoutLimit);

      // Act
      const result = await service.calculateUtilization('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('getUpcomingPaymentDues', () => {
    it('should return upcoming payment dues within specified days', async () => {
      // Arrange
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3); // 3 days from now

      const cards = [mockCard];
      const balances = [
        {
          ...mockBalance,
          paymentDueDate: dueDate,
          minimumPayment: 75
        }
      ];

      cardsRepository.findByUser.mockResolvedValue(cards);
      cardsRepository.findBalancesByUser.mockResolvedValue(balances);

      // Act
      const result = await service.getUpcomingPaymentDues('user-123', 7);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          cardId: mockCard._id!.toString(),
          displayName: mockCard.displayName,
          daysUntilDue: 3,
          minimumPayment: 75
        })
      );
    });

    it('should exclude overdue payments', async () => {
      // Arrange
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 5); // 5 days ago

      const cards = [mockCard];
      const balances = [
        {
          ...mockBalance,
          paymentDueDate: overdueDate,
          minimumPayment: 75
        }
      ];

      cardsRepository.findByUser.mockResolvedValue(cards);
      cardsRepository.findBalancesByUser.mockResolvedValue(balances);

      // Act
      const result = await service.getUpcomingPaymentDues('user-123', 7);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should sort results by days until due', async () => {
      // Arrange
      const card1 = { ...mockCard, _id: 'card-1', displayName: 'Card 1' };
      const card2 = { ...mockCard, _id: 'card-2', displayName: 'Card 2' };

      const dueDate1 = new Date();
      dueDate1.setDate(dueDate1.getDate() + 5);
      const dueDate2 = new Date();
      dueDate2.setDate(dueDate2.getDate() + 2);

      const cards = [card1, card2];
      const balances = [
        { ...mockBalance, cardId: 'card-1', paymentDueDate: dueDate1, minimumPayment: 50 },
        { ...mockBalance, cardId: 'card-2', paymentDueDate: dueDate2, minimumPayment: 75 }
      ];

      cardsRepository.findByUser.mockResolvedValue(cards);
      cardsRepository.findBalancesByUser.mockResolvedValue(balances);

      // Act
      const result = await service.getUpcomingPaymentDues('user-123', 7);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].daysUntilDue).toBe(2); // Card 2 due sooner
      expect(result[1].daysUntilDue).toBe(5); // Card 1 due later
    });
  });

  describe('calculateTotalDebt', () => {
    it('should calculate total debt across all cards', async () => {
      // Arrange
      const balances = [
        {
          ...mockBalance,
          currentBalance: 1500,
          minimumPayment: 75,
          availableCredit: 3500,
          utilizationRate: 30,
          isOverdue: false
        },
        {
          ...mockBalance,
          cardId: 'card-2',
          currentBalance: 2000,
          minimumPayment: 100,
          availableCredit: 3000,
          utilizationRate: 40,
          isOverdue: true,
          overdueAmount: 150
        }
      ];

      cardsRepository.findBalancesByUser.mockResolvedValue(balances);

      // Act
      const result = await service.calculateTotalDebt('user-123');

      // Assert
      expect(result).toEqual({
        totalBalance: 3500,
        totalMinimumPayment: 175,
        totalAvailableCredit: 6500,
        averageUtilization: 35, // (30 + 40) / 2
        overdueAmount: 150
      });
    });

    it('should handle empty balances array', async () => {
      // Arrange
      cardsRepository.findBalancesByUser.mockResolvedValue([]);

      // Act
      const result = await service.calculateTotalDebt('user-123');

      // Assert
      expect(result).toEqual({
        totalBalance: 0,
        totalMinimumPayment: 0,
        totalAvailableCredit: 0,
        averageUtilization: 0,
        overdueAmount: 0
      });
    });

    it('should handle balances without utilization rates', async () => {
      // Arrange
      const balances = [
        {
          ...mockBalance,
          currentBalance: 1000,
          minimumPayment: 50,
          availableCredit: 0,
          utilizationRate: undefined, // Debit card
          isOverdue: false
        }
      ];

      cardsRepository.findBalancesByUser.mockResolvedValue(balances);

      // Act
      const result = await service.calculateTotalDebt('user-123');

      // Assert
      expect(result).toEqual({
        totalBalance: 1000,
        totalMinimumPayment: 50,
        totalAvailableCredit: 0,
        averageUtilization: 0, // No credit cards
        overdueAmount: 0
      });
    });
  });

  describe('checkOverduePayments', () => {
    it('should return overdue balances for user', async () => {
      // Arrange
      const overdueBalances = [mockBalance];
      cardsRepository.findOverdueBalances.mockResolvedValue(overdueBalances);

      // Act
      const result = await service.checkOverduePayments('user-123');

      // Assert
      expect(result).toEqual(overdueBalances);
      expect(cardsRepository.findOverdueBalances).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getBalanceHistory', () => {
    it('should return current balance as history', async () => {
      // Arrange
      cardsRepository.findBalance.mockResolvedValue(mockBalance);

      // Act
      const result = await service.getBalanceHistory('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toEqual([mockBalance]);
    });

    it('should return empty array when no balance found', async () => {
      // Arrange
      cardsRepository.findBalance.mockResolvedValue(null);

      // Act
      const result = await service.getBalanceHistory('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toEqual([]);
    });
  });
});
