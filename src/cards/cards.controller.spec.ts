import { CardBrand, CardStatus, CardType, StatsPeriod } from '@common/constants/card-types';
import { CardLimitExceededException, CardNotFoundException, DuplicateCardNameException } from '@common/exceptions/card.exceptions';
import { Test, TestingModule } from '@nestjs/testing';
import { IUser } from '../users/interfaces/user.interface';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { CardQueryDto, CreateCardBalanceDto, CreateCardDto, UpdateCardDto } from './dto';
import { IMaskedCard } from './interfaces/card.interface';
import { CardAnalyticsService } from './services/card-analytics.service';

describe('CardsController', () => {
  let controller: CardsController;
  let cardsService: jest.Mocked<CardsService>;
  let cardAnalyticsService: jest.Mocked<CardAnalyticsService>;

  const mockUser: IUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    accounts: ['507f1f77bcf86cd799439012']
  };

  const mockCard: IMaskedCard = {
    id: '507f1f77bcf86cd799439011',
    userId: 'user-123',
    accountId: '507f1f77bcf86cd799439012',
    displayName: 'Test Credit Card',
    cardType: CardType.CREDIT,
    cardBrand: CardBrand.VISA,
    status: CardStatus.ACTIVE,
    isDefault: true,
    creditLimit: 5000,
    lastFourDigits: '****1234',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockBalance = {
    cardId: '507f1f77bcf86cd799439011',
    currentBalance: 1500,
    availableCredit: 3500,
    utilizationRate: 30,
    minimumPayment: 75,
    paymentDueDate: new Date('2024-02-15')
  };

  beforeEach(async () => {
    const mockCardsService = {
      createCard: jest.fn(),
      findAllCards: jest.fn(),
      findCardById: jest.fn(),
      updateCard: jest.fn(),
      softDeleteCard: jest.fn(),
      setDefaultCard: jest.fn(),
      activateCard: jest.fn(),
      deactivateCard: jest.fn(),
      getCardBalance: jest.fn(),
      updateCardBalance: jest.fn(),
      getPaymentDueSummary: jest.fn(),
      getTotalDebtAcrossCards: jest.fn()
    };

    const mockCardAnalyticsService = {
      getCardStatistics: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardsController],
      providers: [
        {
          provide: CardsService,
          useValue: mockCardsService
        },
        {
          provide: CardAnalyticsService,
          useValue: mockCardAnalyticsService
        }
      ]
    }).compile();

    controller = module.get<CardsController>(CardsController);
    cardsService = module.get(CardsService);
    cardAnalyticsService = module.get(CardAnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createCardDto: CreateCardDto = {
      accountId: '507f1f77bcf86cd799439012',
      displayName: 'Test Credit Card',
      cardType: CardType.CREDIT,
      cardBrand: CardBrand.VISA,
      lastFourDigits: '1234',
      creditLimit: 5000
    };

    it('should create a card successfully', async () => {
      // Arrange
      cardsService.createCard.mockResolvedValue(mockCard);

      // Act
      const result = await controller.create(createCardDto, mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockCard,
        message: 'Card created successfully'
      });
      expect(cardsService.createCard).toHaveBeenCalledWith('user-123', '507f1f77bcf86cd799439012', createCardDto);
    });

    it('should handle CardLimitExceededException', async () => {
      // Arrange
      cardsService.createCard.mockRejectedValue(new CardLimitExceededException('user-123', '507f1f77bcf86cd799439012', 10, 'trace-123'));

      // Act & Assert
      await expect(controller.create(createCardDto, mockUser)).rejects.toThrow(CardLimitExceededException);
    });

    it('should handle DuplicateCardNameException', async () => {
      // Arrange
      cardsService.createCard.mockRejectedValue(new DuplicateCardNameException('Test Card', 'user-123', '507f1f77bcf86cd799439012', 'trace-123'));

      // Act & Assert
      await expect(controller.create(createCardDto, mockUser)).rejects.toThrow(DuplicateCardNameException);
    });
  });

  describe('findAll', () => {
    const query: CardQueryDto = {
      accountId: '507f1f77bcf86cd799439012',
      page: 1,
      limit: 10
    };

    it('should return paginated cards successfully', async () => {
      // Arrange
      const mockResult = {
        cards: [mockCard],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      };
      cardsService.findAllCards.mockResolvedValue(mockResult);

      // Act
      const result = await controller.findAll(query, mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: {
          cards: [mockCard],
          pagination: {
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1
          }
        },
        message: 'Cards retrieved successfully'
      });
      expect(cardsService.findAllCards).toHaveBeenCalledWith('user-123', query.accountId, query);
    });

    it('should throw error when accountId is missing', async () => {
      // Arrange
      const queryWithoutAccountId = { page: 1, limit: 10 };

      // Act & Assert
      await expect(controller.findAll(queryWithoutAccountId, mockUser)).rejects.toThrow('Account ID is required');
    });
  });

  describe('findOne', () => {
    it('should return card details successfully', async () => {
      // Arrange
      cardsService.findCardById.mockResolvedValue(mockCard);

      // Act
      const result = await controller.findOne('507f1f77bcf86cd799439011', mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockCard,
        message: 'Card retrieved successfully'
      });
      expect(cardsService.findCardById).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'user-123');
    });

    it('should handle CardNotFoundException', async () => {
      // Arrange
      cardsService.findCardById.mockRejectedValue(new CardNotFoundException('507f1f77bcf86cd799439011', 'trace-123'));

      // Act & Assert
      await expect(controller.findOne('507f1f77bcf86cd799439011', mockUser)).rejects.toThrow(CardNotFoundException);
    });
  });

  describe('update', () => {
    const updateCardDto: UpdateCardDto = {
      displayName: 'Updated Card Name',
      creditLimit: 6000
    };

    it('should update card successfully', async () => {
      // Arrange
      const updatedCard = { ...mockCard, ...updateCardDto };
      cardsService.updateCard.mockResolvedValue(updatedCard);

      // Act
      const result = await controller.update('507f1f77bcf86cd799439011', updateCardDto, mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: updatedCard,
        message: 'Card updated successfully'
      });
      expect(cardsService.updateCard).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'user-123', updateCardDto);
    });
  });

  describe('remove', () => {
    it('should soft delete card successfully', async () => {
      // Arrange
      cardsService.softDeleteCard.mockResolvedValue();

      // Act
      await controller.remove('507f1f77bcf86cd799439011', mockUser);

      // Assert
      expect(cardsService.softDeleteCard).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'user-123');
    });
  });

  describe('setDefault', () => {
    it('should set card as default successfully', async () => {
      // Arrange
      const defaultCard = { ...mockCard, isDefault: true };
      cardsService.setDefaultCard.mockResolvedValue(defaultCard);

      // Act
      const result = await controller.setDefault('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: defaultCard,
        message: 'Card set as default successfully'
      });
      expect(cardsService.setDefaultCard).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'user-123', '507f1f77bcf86cd799439012');
    });
  });

  describe('activate', () => {
    it('should activate card successfully', async () => {
      // Arrange
      const activatedCard = { ...mockCard, status: CardStatus.ACTIVE };
      cardsService.activateCard.mockResolvedValue(activatedCard);

      // Act
      const result = await controller.activate('507f1f77bcf86cd799439011', mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: activatedCard,
        message: 'Card activated successfully'
      });
      expect(cardsService.activateCard).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'user-123');
    });
  });

  describe('deactivate', () => {
    it('should deactivate card successfully', async () => {
      // Arrange
      const deactivatedCard = { ...mockCard, status: CardStatus.INACTIVE };
      cardsService.deactivateCard.mockResolvedValue(deactivatedCard);

      // Act
      const result = await controller.deactivate('507f1f77bcf86cd799439011', mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: deactivatedCard,
        message: 'Card deactivated successfully'
      });
      expect(cardsService.deactivateCard).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'user-123');
    });
  });

  describe('getBalance', () => {
    it('should get card balance successfully', async () => {
      // Arrange
      cardsService.getCardBalance.mockResolvedValue(mockBalance);

      // Act
      const result = await controller.getBalance('507f1f77bcf86cd799439011', mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockBalance,
        message: 'Card balance retrieved successfully'
      });
      expect(cardsService.getCardBalance).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'user-123');
    });
  });

  describe('updateBalance', () => {
    const balanceDto: CreateCardBalanceDto = {
      currentBalance: 2000,
      isAutomaticUpdate: false
    };

    it('should update card balance successfully', async () => {
      // Arrange
      const updatedBalance = { ...mockBalance, currentBalance: 2000 };
      cardsService.updateCardBalance.mockResolvedValue(updatedBalance);

      // Act
      const result = await controller.updateBalance('507f1f77bcf86cd799439011', balanceDto, mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: updatedBalance,
        message: 'Card balance updated successfully'
      });
      expect(cardsService.updateCardBalance).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'user-123', balanceDto);
    });
  });

  describe('getPaymentDueSummary', () => {
    it('should get payment due summary successfully', async () => {
      // Arrange
      const mockSummary = [
        {
          cardId: '507f1f77bcf86cd799439011',
          displayName: 'Test Card',
          dueDate: new Date('2024-02-15'),
          minimumPayment: 75,
          currentBalance: 1500,
          daysUntilDue: 5
        }
      ];
      cardsService.getPaymentDueSummary.mockResolvedValue(mockSummary);

      // Act
      const result = await controller.getPaymentDueSummary(mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockSummary,
        message: 'Payment due summary retrieved successfully'
      });
      expect(cardsService.getPaymentDueSummary).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getTotalDebt', () => {
    it('should get total debt summary successfully', async () => {
      // Arrange
      const mockDebtSummary = {
        totalBalance: 5000,
        totalMinimumPayment: 250,
        totalAvailableCredit: 15000,
        averageUtilization: 25,
        overdueAmount: 0
      };
      cardsService.getTotalDebtAcrossCards.mockResolvedValue(mockDebtSummary);

      // Act
      const result = await controller.getTotalDebt(mockUser, '507f1f77bcf86cd799439012');

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockDebtSummary,
        message: 'Total debt summary retrieved successfully'
      });
      expect(cardsService.getTotalDebtAcrossCards).toHaveBeenCalledWith('user-123', '507f1f77bcf86cd799439012');
    });

    it('should get total debt summary without accountId filter', async () => {
      // Arrange
      const mockDebtSummary = {
        totalBalance: 8000,
        totalMinimumPayment: 400,
        totalAvailableCredit: 20000,
        averageUtilization: 30,
        overdueAmount: 150
      };
      cardsService.getTotalDebtAcrossCards.mockResolvedValue(mockDebtSummary);

      // Act
      const result = await controller.getTotalDebt(mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockDebtSummary,
        message: 'Total debt summary retrieved successfully'
      });
      expect(cardsService.getTotalDebtAcrossCards).toHaveBeenCalledWith('user-123', undefined);
    });
  });

  describe('getAnalytics', () => {
    it('should get card analytics successfully', async () => {
      // Arrange
      const mockAnalytics = {
        cardId: '507f1f77bcf86cd799439011',
        period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        totalSpent: 2500,
        totalTransactions: 25,
        averageTransaction: 100,
        currentBalance: 1500,
        availableCredit: 3500,
        utilizationRate: 30,
        categoryBreakdown: [],
        monthlySpending: [],
        topMerchants: []
      };
      cardAnalyticsService.getCardStatistics.mockResolvedValue(mockAnalytics);

      // Act
      const result = await controller.getAnalytics('507f1f77bcf86cd799439011', StatsPeriod.MONTH, '2024-01-01', '2024-01-31', mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockAnalytics,
        message: 'Card analytics retrieved successfully'
      });
      expect(cardAnalyticsService.getCardStatistics).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        StatsPeriod.MONTH,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );
    });

    it('should get card analytics with period only', async () => {
      // Arrange
      const mockAnalytics = {
        cardId: '507f1f77bcf86cd799439011',
        period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        totalSpent: 1800,
        totalTransactions: 18,
        averageTransaction: 100,
        currentBalance: 1200,
        availableCredit: 3800,
        utilizationRate: 24,
        categoryBreakdown: [],
        monthlySpending: [],
        topMerchants: []
      };
      cardAnalyticsService.getCardStatistics.mockResolvedValue(mockAnalytics);

      // Act
      const result = await controller.getAnalytics('507f1f77bcf86cd799439011', StatsPeriod.WEEK, undefined, undefined, mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockAnalytics,
        message: 'Card analytics retrieved successfully'
      });
      expect(cardAnalyticsService.getCardStatistics).toHaveBeenCalledWith('507f1f77bcf86cd799439011', StatsPeriod.WEEK, undefined, undefined);
    });

    it('should get card analytics with default parameters', async () => {
      // Arrange
      const mockAnalytics = {
        cardId: '507f1f77bcf86cd799439011',
        period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        totalSpent: 2200,
        totalTransactions: 22,
        averageTransaction: 100,
        currentBalance: 1300,
        availableCredit: 3700,
        utilizationRate: 26,
        categoryBreakdown: [],
        monthlySpending: [],
        topMerchants: []
      };
      cardAnalyticsService.getCardStatistics.mockResolvedValue(mockAnalytics);

      // Act
      const result = await controller.getAnalytics('507f1f77bcf86cd799439011', undefined, undefined, undefined, mockUser);

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockAnalytics,
        message: 'Card analytics retrieved successfully'
      });
      expect(cardAnalyticsService.getCardStatistics).toHaveBeenCalledWith('507f1f77bcf86cd799439011', undefined, undefined, undefined);
    });
  });
});
