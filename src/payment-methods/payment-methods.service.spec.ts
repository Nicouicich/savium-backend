import { DEFAULT_PAYMENT_METHODS, PaymentMethodType } from '@common/constants/card-types';
import { BusinessLogicException, NotFoundResourceException } from '@common/exceptions/business.exceptions';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import { PaymentMethodsRepository } from './payment-methods.repository';
import { PaymentMethodsService } from './payment-methods.service';

describe('PaymentMethodsService', () => {
  let service: PaymentMethodsService;
  let repository: jest.Mocked<PaymentMethodsRepository>;

  const mockPaymentMethod = new PaymentMethodEntity({
    _id: '507f1f77bcf86cd799439011' as any,
    name: 'Credit Card',
    code: 'CREDIT_CARD',
    type: PaymentMethodType.CARD,
    requiresCard: true,
    isActive: true,
    sortOrder: 1,
    icon: 'credit-card',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const mockDebitMethod = new PaymentMethodEntity({
    _id: '507f1f77bcf86cd799439012' as any,
    name: 'Debit Card',
    code: 'DEBIT_CARD',
    type: PaymentMethodType.CARD,
    requiresCard: true,
    isActive: true,
    sortOrder: 2,
    icon: 'debit-card',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const mockCashMethod = new PaymentMethodEntity({
    _id: '507f1f77bcf86cd799439013' as any,
    name: 'Cash',
    code: 'CASH',
    type: PaymentMethodType.CASH,
    requiresCard: false,
    isActive: true,
    sortOrder: 3,
    icon: 'cash',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  beforeEach(async () => {
    const mockRepository = {
      findAllActive: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      findByType: jest.fn(),
      findCardRequiredMethods: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      updateSortOrders: jest.fn(),
      delete: jest.fn(),
      codeExists: jest.fn(),
      getNextSortOrder: jest.fn(),
      getStatistics: jest.fn(),
      bulkCreate: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodsService,
        {
          provide: PaymentMethodsRepository,
          useValue: mockRepository
        }
      ]
    }).compile();

    service = module.get<PaymentMethodsService>(PaymentMethodsService);
    repository = module.get(PaymentMethodsRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize default payment methods when none exist', async () => {
      // Arrange
      repository.getStatistics.mockResolvedValue({ total: 0, active: 0, byType: {} });
      repository.bulkCreate.mockResolvedValue([mockPaymentMethod]);

      // Act
      await service.onModuleInit();

      // Assert
      expect(repository.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            isActive: true
          })
        ])
      );
    });

    it('should skip initialization when payment methods already exist', async () => {
      // Arrange
      repository.getStatistics.mockResolvedValue({ total: 5, active: 5, byType: {} });

      // Act
      await service.onModuleInit();

      // Assert
      expect(repository.bulkCreate).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      // Arrange
      repository.getStatistics.mockResolvedValue({ total: 0, active: 0, byType: {} });
      repository.bulkCreate.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('findAllActive', () => {
    it('should return all active payment methods', async () => {
      // Arrange
      const activeMethods = [mockPaymentMethod, mockDebitMethod];
      repository.findAllActive.mockResolvedValue(activeMethods);

      // Act
      const result = await service.findAllActive();

      // Assert
      expect(result).toEqual(activeMethods);
      expect(repository.findAllActive).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all payment methods including inactive', async () => {
      // Arrange
      const allMethods = [mockPaymentMethod, mockDebitMethod, mockCashMethod];
      repository.findAll.mockResolvedValue(allMethods);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(allMethods);
      expect(repository.findAll).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return payment method when found', async () => {
      // Arrange
      repository.findById.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.findById('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toEqual(mockPaymentMethod);
      expect(repository.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundResourceException when not found', async () => {
      // Arrange
      repository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('invalid-id')).rejects.toThrow(NotFoundResourceException);
    });
  });

  describe('findByCode', () => {
    it('should return payment method when found by code', async () => {
      // Arrange
      repository.findByCode.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.findByCode('CREDIT_CARD');

      // Assert
      expect(result).toEqual(mockPaymentMethod);
      expect(repository.findByCode).toHaveBeenCalledWith('CREDIT_CARD');
    });

    it('should return null when not found by code', async () => {
      // Arrange
      repository.findByCode.mockResolvedValue(null);

      // Act
      const result = await service.findByCode('INVALID_CODE');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByType', () => {
    it('should return payment methods of specified type', async () => {
      // Arrange
      const cardMethods = [mockPaymentMethod, mockDebitMethod];
      repository.findByType.mockResolvedValue(cardMethods);

      // Act
      const result = await service.findByType(PaymentMethodType.CARD);

      // Assert
      expect(result).toEqual(cardMethods);
      expect(repository.findByType).toHaveBeenCalledWith(PaymentMethodType.CARD);
    });
  });

  describe('findCardRequiredMethods', () => {
    it('should return payment methods that require cards', async () => {
      // Arrange
      const cardRequiredMethods = [mockPaymentMethod, mockDebitMethod];
      repository.findCardRequiredMethods.mockResolvedValue(cardRequiredMethods);

      // Act
      const result = await service.findCardRequiredMethods();

      // Assert
      expect(result).toEqual(cardRequiredMethods);
      expect(repository.findCardRequiredMethods).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const createData = {
      name: 'Bank Transfer',
      code: 'BANK_TRANSFER',
      type: PaymentMethodType.BANK_TRANSFER,
      requiresCard: false,
      icon: 'bank',
      sortOrder: 10
    };

    it('should create payment method successfully', async () => {
      // Arrange
      repository.codeExists.mockResolvedValue(false);
      repository.create.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.create(createData);

      // Assert
      expect(result).toEqual(mockPaymentMethod);
      expect(repository.codeExists).toHaveBeenCalledWith('BANK_TRANSFER');
      expect(repository.create).toHaveBeenCalledWith({
        ...createData,
        code: 'BANK_TRANSFER',
        isActive: true
      });
    });

    it('should convert code to uppercase', async () => {
      // Arrange
      repository.codeExists.mockResolvedValue(false);
      repository.create.mockResolvedValue(mockPaymentMethod);

      const dataWithLowerCase = { ...createData, code: 'bank_transfer' };

      // Act
      await service.create(dataWithLowerCase);

      // Assert
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'BANK_TRANSFER'
        })
      );
    });

    it('should set default sort order when not provided', async () => {
      // Arrange
      repository.codeExists.mockResolvedValue(false);
      repository.getNextSortOrder.mockResolvedValue(15);
      repository.create.mockResolvedValue(mockPaymentMethod);

      const dataWithoutSortOrder = { ...createData };
      delete dataWithoutSortOrder.sortOrder;

      // Act
      await service.create(dataWithoutSortOrder);

      // Assert
      expect(repository.getNextSortOrder).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sortOrder: 15
        })
      );
    });

    it('should set requiresCard based on type when not provided', async () => {
      // Arrange
      repository.codeExists.mockResolvedValue(false);
      repository.create.mockResolvedValue(mockPaymentMethod);

      const cardTypeData = {
        name: 'New Card',
        code: 'NEW_CARD',
        type: PaymentMethodType.CARD
      };

      // Act
      await service.create(cardTypeData);

      // Assert
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requiresCard: true
        })
      );
    });

    it('should throw BusinessLogicException when code already exists', async () => {
      // Arrange
      repository.codeExists.mockResolvedValue(true);

      // Act & Assert
      await expect(service.create(createData)).rejects.toThrow(BusinessLogicException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateData = {
      name: 'Updated Credit Card',
      icon: 'new-icon',
      sortOrder: 5
    };

    it('should update payment method successfully', async () => {
      // Arrange
      repository.findById.mockResolvedValue(mockPaymentMethod);
      repository.update.mockResolvedValue({ ...mockPaymentMethod, ...updateData });

      // Act
      const result = await service.update('507f1f77bcf86cd799439011', updateData);

      // Assert
      expect(result).toEqual({ ...mockPaymentMethod, ...updateData });
      expect(repository.update).toHaveBeenCalledWith('507f1f77bcf86cd799439011', updateData);
    });

    it('should throw NotFoundResourceException when payment method not found', async () => {
      // Arrange
      repository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('invalid-id', updateData)).rejects.toThrow(NotFoundResourceException);
    });

    it('should throw NotFoundResourceException when update fails', async () => {
      // Arrange
      repository.findById.mockResolvedValue(mockPaymentMethod);
      repository.update.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('507f1f77bcf86cd799439011', updateData)).rejects.toThrow(NotFoundResourceException);
    });
  });

  describe('updateSortOrders', () => {
    const sortUpdates = [
      { id: '507f1f77bcf86cd799439011', sortOrder: 1 },
      { id: '507f1f77bcf86cd799439012', sortOrder: 2 }
    ];

    it('should update sort orders successfully', async () => {
      // Arrange
      repository.findById.mockResolvedValueOnce(mockPaymentMethod).mockResolvedValueOnce(mockDebitMethod);
      repository.updateSortOrders.mockResolvedValue();

      // Act
      await service.updateSortOrders(sortUpdates);

      // Assert
      expect(repository.updateSortOrders).toHaveBeenCalledWith(sortUpdates);
    });

    it('should validate all IDs exist before updating', async () => {
      // Arrange
      repository.findById.mockResolvedValueOnce(mockPaymentMethod).mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.updateSortOrders(sortUpdates)).rejects.toThrow(NotFoundResourceException);
      expect(repository.updateSortOrders).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('should activate payment method successfully', async () => {
      // Arrange
      const activatedMethod = { ...mockPaymentMethod, isActive: true };
      repository.updateStatus.mockResolvedValue(activatedMethod);

      // Act
      const result = await service.activate('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toEqual(activatedMethod);
      expect(repository.updateStatus).toHaveBeenCalledWith('507f1f77bcf86cd799439011', true);
    });

    it('should throw NotFoundResourceException when activation fails', async () => {
      // Arrange
      repository.updateStatus.mockResolvedValue(null);

      // Act & Assert
      await expect(service.activate('invalid-id')).rejects.toThrow(NotFoundResourceException);
    });
  });

  describe('deactivate', () => {
    it('should deactivate custom payment method successfully', async () => {
      // Arrange
      const customMethod = { ...mockPaymentMethod, code: 'CUSTOM_METHOD' };
      const deactivatedMethod = { ...customMethod, isActive: false };

      repository.findById.mockResolvedValue(customMethod);
      repository.updateStatus.mockResolvedValue(deactivatedMethod);

      // Act
      const result = await service.deactivate('507f1f77bcf86cd799439011');

      // Assert
      expect(result).toEqual(deactivatedMethod);
      expect(repository.updateStatus).toHaveBeenCalledWith('507f1f77bcf86cd799439011', false);
    });

    it('should prevent deactivating default payment methods', async () => {
      // Arrange
      const defaultMethod = { ...mockPaymentMethod, code: DEFAULT_PAYMENT_METHODS[0].code };
      repository.findById.mockResolvedValue(defaultMethod);

      // Act & Assert
      await expect(service.deactivate('507f1f77bcf86cd799439011')).rejects.toThrow(BusinessLogicException);
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw NotFoundResourceException when deactivation fails', async () => {
      // Arrange
      const customMethod = { ...mockPaymentMethod, code: 'CUSTOM_METHOD' };
      repository.findById.mockResolvedValue(customMethod);
      repository.updateStatus.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deactivate('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundResourceException);
    });
  });

  describe('delete', () => {
    it('should delete custom payment method successfully', async () => {
      // Arrange
      const customMethod = { ...mockPaymentMethod, code: 'CUSTOM_METHOD' };
      repository.findById.mockResolvedValue(customMethod);
      repository.delete.mockResolvedValue(true);

      // Act
      await service.delete('507f1f77bcf86cd799439011');

      // Assert
      expect(repository.delete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should prevent deleting default payment methods', async () => {
      // Arrange
      const defaultMethod = { ...mockPaymentMethod, code: DEFAULT_PAYMENT_METHODS[0].code };
      repository.findById.mockResolvedValue(defaultMethod);

      // Act & Assert
      await expect(service.delete('507f1f77bcf86cd799439011')).rejects.toThrow(BusinessLogicException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('should throw BusinessLogicException when deletion fails', async () => {
      // Arrange
      const customMethod = { ...mockPaymentMethod, code: 'CUSTOM_METHOD' };
      repository.findById.mockResolvedValue(customMethod);
      repository.delete.mockResolvedValue(false);

      // Act & Assert
      await expect(service.delete('507f1f77bcf86cd799439011')).rejects.toThrow(BusinessLogicException);
    });
  });

  describe('getStatistics', () => {
    it('should return payment method statistics', async () => {
      // Arrange
      const stats = {
        total: 10,
        active: 8,
        byType: {
          [PaymentMethodType.CARD]: 5,
          [PaymentMethodType.CASH]: 2,
          [PaymentMethodType.BANK_TRANSFER]: 3
        }
      };
      repository.getStatistics.mockResolvedValue(stats);

      // Act
      const result = await service.getStatistics();

      // Assert
      expect(result).toEqual(stats);
      expect(repository.getStatistics).toHaveBeenCalled();
    });
  });

  describe('validatePaymentMethodUsage', () => {
    it('should validate active payment method that does not require card', async () => {
      // Arrange
      repository.findById.mockResolvedValue(mockCashMethod);

      // Act
      const result = await service.validatePaymentMethodUsage('507f1f77bcf86cd799439013', false);

      // Assert
      expect(result).toEqual({ isValid: true });
    });

    it('should validate active payment method with card when required', async () => {
      // Arrange
      repository.findById.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.validatePaymentMethodUsage('507f1f77bcf86cd799439011', true);

      // Assert
      expect(result).toEqual({ isValid: true });
    });

    it('should reject inactive payment method', async () => {
      // Arrange
      const inactiveMethod = { ...mockPaymentMethod, isActive: false };
      repository.findById.mockResolvedValue(inactiveMethod);

      // Act
      const result = await service.validatePaymentMethodUsage('507f1f77bcf86cd799439011', true);

      // Assert
      expect(result).toEqual({
        isValid: false,
        reason: 'Payment method is not active'
      });
    });

    it('should reject payment method that requires card when no card provided', async () => {
      // Arrange
      repository.findById.mockResolvedValue(mockPaymentMethod);

      // Act
      const result = await service.validatePaymentMethodUsage('507f1f77bcf86cd799439011', false);

      // Assert
      expect(result).toEqual({
        isValid: false,
        reason: 'Payment method requires a card but no card was provided'
      });
    });
  });

  describe('seedPaymentMethods', () => {
    const seedData = [
      {
        name: 'PayPal',
        code: 'PAYPAL',
        type: PaymentMethodType.DIGITAL_WALLET,
        requiresCard: false,
        icon: 'paypal'
      },
      {
        name: 'Apple Pay',
        code: 'APPLE_PAY',
        type: PaymentMethodType.DIGITAL_WALLET,
        requiresCard: true,
        icon: 'apple-pay'
      }
    ];

    it('should seed payment methods successfully', async () => {
      // Arrange
      repository.codeExists.mockResolvedValue(false);
      repository.create.mockResolvedValueOnce({ ...mockPaymentMethod, ...seedData[0] }).mockResolvedValueOnce({ ...mockPaymentMethod, ...seedData[1] });

      // Act
      const result = await service.seedPaymentMethods(seedData);

      // Assert
      expect(result).toHaveLength(2);
      expect(repository.create).toHaveBeenCalledTimes(2);
    });

    it('should handle individual failures gracefully', async () => {
      // Arrange
      repository.codeExists.mockResolvedValue(false);
      repository.create.mockResolvedValueOnce({ ...mockPaymentMethod, ...seedData[0] }).mockRejectedValueOnce(new Error('Creation failed'));

      // Act
      const result = await service.seedPaymentMethods(seedData);

      // Assert
      expect(result).toHaveLength(1);
      expect(repository.create).toHaveBeenCalledTimes(2);
    });

    it('should skip duplicate codes during seeding', async () => {
      // Arrange
      repository.codeExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      repository.create.mockResolvedValueOnce({ ...mockPaymentMethod, ...seedData[1] });

      // Act
      const result = await service.seedPaymentMethods(seedData);

      // Assert
      expect(result).toHaveLength(1);
      expect(repository.create).toHaveBeenCalledTimes(1);
    });
  });
});
