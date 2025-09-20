import { Test, TestingModule } from '@nestjs/testing';
import { CardsService } from './cards.service';
import { CardsRepository } from './cards.repository';
import { EncryptionService } from '@common/services/encryption.service';
import { RequestContextService } from '@common/services/request-context.service';
import { CardEntity } from './entities/card.entity';
import { CreateCardDto } from './dto/create-card.dto';
import { CardType, CardBrand, CardStatus } from '@common/constants/card-types';
import { CardNotFoundException, CardLimitExceededException, DuplicateCardNameException } from '@common/exceptions/card.exceptions';

describe('CardsService', () => {
  let service: CardsService;
  let cardsRepository: jest.Mocked<CardsRepository>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let requestContextService: jest.Mocked<RequestContextService>;

  const mockCard = new CardEntity({
    _id: '507f1f77bcf86cd799439011' as any,
    userId: 'user-123',
    accountId: '507f1f77bcf86cd799439012' as any,
    displayName: 'Test Card',
    cardType: CardType.CREDIT,
    cardBrand: CardBrand.VISA,
    status: CardStatus.ACTIVE,
    isDefault: true,
    creditLimit: 5000,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  beforeEach(async () => {
    const mockCardsRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserAndAccount: jest.fn(),
      countByUserAndAccount: jest.fn(),
      isDisplayNameUnique: jest.fn(),
      setAsDefault: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      upsertBalance: jest.fn(),
      findBalance: jest.fn()
    };

    const mockEncryptionService = {
      encryptLastFourDigits: jest.fn(),
      decrypt: jest.fn(),
      maskSensitiveData: jest.fn()
    };

    const mockRequestContextService = {
      getTraceId: jest.fn().mockReturnValue('trace-123'),
      getUserId: jest.fn().mockReturnValue('user-123')
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardsService,
        {
          provide: CardsRepository,
          useValue: mockCardsRepository
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService
        },
        {
          provide: RequestContextService,
          useValue: mockRequestContextService
        }
      ]
    }).compile();

    service = module.get<CardsService>(CardsService);
    cardsRepository = module.get(CardsRepository);
    encryptionService = module.get(EncryptionService);
    requestContextService = module.get(RequestContextService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCard', () => {
    const createCardDto: CreateCardDto = {
      displayName: 'Test Card',
      cardType: CardType.CREDIT,
      cardBrand: CardBrand.VISA,
      lastFourDigits: '1234',
      creditLimit: 5000,
      accountId: '507f1f77bcf86cd799439012'
    };

    it('should create a card successfully', async () => {
      // Arrange
      cardsRepository.countByUserAndAccount.mockResolvedValue(0);
      cardsRepository.isDisplayNameUnique.mockResolvedValue(true);
      encryptionService.encryptLastFourDigits.mockReturnValue({
        encrypted: 'encrypted-data',
        iv: 'iv',
        authTag: 'tag'
      });
      cardsRepository.create.mockResolvedValue(mockCard);
      cardsRepository.upsertBalance.mockResolvedValue(null as any);

      // Act
      const result = await service.createCard('user-123', '507f1f77bcf86cd799439012', createCardDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.displayName).toBe(createCardDto.displayName);
      expect(cardsRepository.create).toHaveBeenCalledWith({
        ...createCardDto,
        userId: 'user-123',
        accountId: '507f1f77bcf86cd799439012',
        lastFourDigits: {
          encrypted: 'encrypted-data',
          iv: 'iv',
          authTag: 'tag'
        },
        isDefault: true, // First card should be default
        status: CardStatus.ACTIVE
      });
    });

    it('should encrypt last four digits if provided', async () => {
      // Arrange
      cardsRepository.countByUserAndAccount.mockResolvedValue(0);
      cardsRepository.isDisplayNameUnique.mockResolvedValue(true);
      encryptionService.encryptLastFourDigits.mockReturnValue({
        encrypted: 'encrypted-1234',
        iv: 'test-iv',
        authTag: 'test-tag'
      });
      cardsRepository.create.mockResolvedValue(mockCard);

      // Act
      await service.createCard('user-123', '507f1f77bcf86cd799439012', createCardDto);

      // Assert
      expect(encryptionService.encryptLastFourDigits).toHaveBeenCalledWith('1234');
    });

    it('should set first card as default', async () => {
      // Arrange
      cardsRepository.countByUserAndAccount.mockResolvedValue(0); // No existing cards
      cardsRepository.isDisplayNameUnique.mockResolvedValue(true);
      cardsRepository.create.mockResolvedValue(mockCard);

      // Act
      await service.createCard('user-123', '507f1f77bcf86cd799439012', createCardDto);

      // Assert
      expect(cardsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isDefault: true
        })
      );
    });

    it('should not set subsequent cards as default', async () => {
      // Arrange
      cardsRepository.countByUserAndAccount.mockResolvedValue(1); // Existing cards
      cardsRepository.isDisplayNameUnique.mockResolvedValue(true);
      cardsRepository.create.mockResolvedValue(mockCard);

      // Act
      await service.createCard('user-123', '507f1f77bcf86cd799439012', createCardDto);

      // Assert
      expect(cardsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isDefault: false
        })
      );
    });

    it('should throw CardLimitExceededException when limit is exceeded', async () => {
      // Arrange
      cardsRepository.countByUserAndAccount.mockResolvedValue(10); // Max limit for personal account

      // Act & Assert
      await expect(service.createCard('user-123', '507f1f77bcf86cd799439012', createCardDto)).rejects.toThrow(CardLimitExceededException);
    });

    it('should throw DuplicateCardNameException for duplicate names', async () => {
      // Arrange
      cardsRepository.countByUserAndAccount.mockResolvedValue(0);
      cardsRepository.isDisplayNameUnique.mockResolvedValue(false);

      // Act & Assert
      await expect(service.createCard('user-123', '507f1f77bcf86cd799439012', createCardDto)).rejects.toThrow(DuplicateCardNameException);
    });

    it('should create initial balance for credit cards', async () => {
      // Arrange
      cardsRepository.countByUserAndAccount.mockResolvedValue(0);
      cardsRepository.isDisplayNameUnique.mockResolvedValue(true);
      cardsRepository.create.mockResolvedValue(mockCard);
      cardsRepository.upsertBalance.mockResolvedValue(null as any);

      // Act
      await service.createCard('user-123', '507f1f77bcf86cd799439012', createCardDto);

      // Assert
      expect(cardsRepository.upsertBalance).toHaveBeenCalledWith(
        mockCard._id!.toString(),
        expect.objectContaining({
          userId: 'user-123',
          currentBalance: 0,
          availableCredit: 5000,
          isAutomaticUpdate: false
        })
      );
    });
  });

  describe('findCardById', () => {
    it('should return masked card when found', async () => {
      // Arrange
      cardsRepository.findById.mockResolvedValue(mockCard);
      encryptionService.decrypt.mockReturnValue('1234');

      // Act
      const result = await service.findCardById('507f1f77bcf86cd799439011', 'user-123');

      // Assert
      expect(result).toBeDefined();
      expect(result.displayName).toBe(mockCard.displayName);
      expect(cardsRepository.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw CardNotFoundException when card not found', async () => {
      // Arrange
      cardsRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findCardById('507f1f77bcf86cd799439011', 'user-123')).rejects.toThrow(CardNotFoundException);
    });

    it('should validate card ownership', async () => {
      // Arrange
      const wrongUserCard = new CardEntity({
        ...mockCard,
        userId: 'wrong-user'
      });
      cardsRepository.findById.mockResolvedValue(wrongUserCard);

      // Act & Assert
      await expect(service.findCardById('507f1f77bcf86cd799439011', 'user-123')).rejects.toThrow(); // Should throw ownership exception
    });
  });

  describe('setDefaultCard', () => {
    it('should set card as default successfully', async () => {
      // Arrange
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardsRepository.setAsDefault.mockResolvedValue(mockCard);

      // Act
      const result = await service.setDefaultCard('507f1f77bcf86cd799439011', 'user-123', '507f1f77bcf86cd799439012');

      // Assert
      expect(result).toBeDefined();
      expect(cardsRepository.setAsDefault).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'user-123', '507f1f77bcf86cd799439012');
    });

    it('should not allow setting expired card as default', async () => {
      // Arrange
      const expiredCard = new CardEntity({
        ...mockCard,
        expiryMonth: 1,
        expiryYear: 2020 // Past year
      });
      cardsRepository.findById.mockResolvedValue(expiredCard);

      // Act & Assert
      await expect(service.setDefaultCard('507f1f77bcf86cd799439011', 'user-123', '507f1f77bcf86cd799439012')).rejects.toThrow(); // Should throw invalid operation exception
    });
  });

  describe('maskCardDetails', () => {
    it('should mask card details correctly', () => {
      // Arrange
      const cardWithEncryptedData = new CardEntity({
        ...mockCard,
        lastFourDigits: {
          encrypted: 'encrypted-data',
          iv: 'iv',
          authTag: 'tag'
        }
      });
      encryptionService.decrypt.mockReturnValue('1234');

      // Act
      const result = service.maskCardDetails(cardWithEncryptedData);

      // Assert
      expect(result.lastFourDigits).toBe('****1234');
      expect(result.displayName).toBe(mockCard.displayName);
      expect(result.cardType).toBe(mockCard.cardType);
    });

    it('should handle decryption errors gracefully', () => {
      // Arrange
      const cardWithEncryptedData = new CardEntity({
        ...mockCard,
        lastFourDigits: {
          encrypted: 'invalid-data',
          iv: 'iv',
          authTag: 'tag'
        }
      });
      encryptionService.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      // Act
      const result = service.maskCardDetails(cardWithEncryptedData);

      // Assert
      expect(result.lastFourDigits).toBeUndefined();
      expect(result.displayName).toBe(mockCard.displayName);
    });
  });
});
