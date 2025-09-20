import { DEFAULT_PAYMENT_METHODS, PaymentMethodType } from '@common/constants/card-types';
import { BusinessLogicException, NotFoundResourceException } from '@common/exceptions/business.exceptions';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import { PaymentMethodsRepository } from './payment-methods.repository';

@Injectable()
export class PaymentMethodsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentMethodsService.name);

  constructor(private readonly paymentMethodsRepository: PaymentMethodsRepository) {}

  /**
   * Initialize default payment methods on module startup
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.initializeDefaultPaymentMethods();
    } catch (error) {
      this.logger.error('Failed to initialize default payment methods', error);
    }
  }

  /**
   * Get all active payment methods
   */
  async findAllActive(): Promise<PaymentMethodEntity[]> {
    return this.paymentMethodsRepository.findAllActive();
  }

  /**
   * Get all payment methods (including inactive)
   */
  async findAll(): Promise<PaymentMethodEntity[]> {
    return this.paymentMethodsRepository.findAll();
  }

  /**
   * Find payment method by ID
   */
  async findById(id: string): Promise<PaymentMethodEntity> {
    const paymentMethod = await this.paymentMethodsRepository.findById(id);

    if (!paymentMethod) {
      throw new NotFoundResourceException('Payment method', id);
    }

    return paymentMethod;
  }

  /**
   * Find payment method by code
   */
  async findByCode(code: string): Promise<PaymentMethodEntity | null> {
    return this.paymentMethodsRepository.findByCode(code);
  }

  /**
   * Get payment methods by type
   */
  async findByType(type: PaymentMethodType): Promise<PaymentMethodEntity[]> {
    return this.paymentMethodsRepository.findByType(type);
  }

  /**
   * Get payment methods that require cards
   */
  async findCardRequiredMethods(): Promise<PaymentMethodEntity[]> {
    return this.paymentMethodsRepository.findCardRequiredMethods();
  }

  /**
   * Create a new payment method
   */
  async create(
    paymentMethodData: { name: string; code: string; type: PaymentMethodType; requiresCard?: boolean; icon?: string; sortOrder?: number }
  ): Promise<PaymentMethodEntity> {
    // Check if code already exists
    const codeExists = await this.paymentMethodsRepository.codeExists(paymentMethodData.code);
    if (codeExists) {
      throw new BusinessLogicException(`Payment method with code '${paymentMethodData.code}' already exists`);
    }

    // Set default sort order if not provided
    if (!paymentMethodData.sortOrder) {
      paymentMethodData.sortOrder = await this.paymentMethodsRepository.getNextSortOrder();
    }

    // Set default requiresCard based on type
    if (paymentMethodData.requiresCard === undefined) {
      paymentMethodData.requiresCard = paymentMethodData.type === PaymentMethodType.CARD;
    }

    return this.paymentMethodsRepository.create({
      ...paymentMethodData,
      code: paymentMethodData.code.toUpperCase(),
      isActive: true
    });
  }

  /**
   * Update payment method
   */
  async update(
    id: string,
    updateData: {
      name?: string;
      icon?: string;
      sortOrder?: number;
      requiresCard?: boolean;
    }
  ): Promise<PaymentMethodEntity> {
    const paymentMethod = await this.findById(id);

    const updated = await this.paymentMethodsRepository.update(id, updateData);

    if (!updated) {
      throw new NotFoundResourceException('Payment method', id);
    }

    this.logger.log(`Payment method updated: ${paymentMethod.code}`);
    return updated;
  }

  /**
   * Update sort orders for multiple payment methods
   */
  async updateSortOrders(sortUpdates: Array<{ id: string; sortOrder: number }>): Promise<void> {
    // Validate all IDs exist
    for (const update of sortUpdates) {
      await this.findById(update.id);
    }

    await this.paymentMethodsRepository.updateSortOrders(sortUpdates);
    this.logger.log(`Updated sort orders for ${sortUpdates.length} payment methods`);
  }

  /**
   * Activate payment method
   */
  async activate(id: string): Promise<PaymentMethodEntity> {
    const updated = await this.paymentMethodsRepository.updateStatus(id, true);

    if (!updated) {
      throw new NotFoundResourceException('Payment method', id);
    }

    this.logger.log(`Payment method activated: ${updated.code}`);
    return updated;
  }

  /**
   * Deactivate payment method
   */
  async deactivate(id: string): Promise<PaymentMethodEntity> {
    const paymentMethod = await this.findById(id);

    // Prevent deactivating default payment methods
    if (DEFAULT_PAYMENT_METHODS.some(pm => pm.code === paymentMethod.code)) {
      throw new BusinessLogicException(`Cannot deactivate default payment method: ${paymentMethod.code}`);
    }

    const updated = await this.paymentMethodsRepository.updateStatus(id, false);

    if (!updated) {
      throw new NotFoundResourceException('Payment method', id);
    }

    this.logger.log(`Payment method deactivated: ${updated.code}`);
    return updated;
  }

  /**
   * Delete payment method
   */
  async delete(id: string): Promise<void> {
    const paymentMethod = await this.findById(id);

    // Prevent deleting default payment methods
    if (DEFAULT_PAYMENT_METHODS.some(pm => pm.code === paymentMethod.code)) {
      throw new BusinessLogicException(`Cannot delete default payment method: ${paymentMethod.code}`);
    }

    // TODO: Check if payment method is being used by any transactions
    // This will be implemented when we integrate with the transaction module

    const deleted = await this.paymentMethodsRepository.delete(id);

    if (!deleted) {
      throw new BusinessLogicException('Failed to delete payment method');
    }

    this.logger.log(`Payment method deleted: ${paymentMethod.code}`);
  }

  /**
   * Get payment method statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    byType: Record<PaymentMethodType, number>;
  }> {
    return this.paymentMethodsRepository.getStatistics();
  }

  /**
   * Validate if a payment method can be used with the provided card information
   */
  async validatePaymentMethodUsage(paymentMethodId: string, hasCard: boolean = false): Promise<{ isValid: boolean; reason?: string }> {
    const paymentMethod = await this.findById(paymentMethodId);

    if (!paymentMethod.isActive) {
      return {
        isValid: false,
        reason: 'Payment method is not active'
      };
    }

    if (paymentMethod.requiresCard && !hasCard) {
      return {
        isValid: false,
        reason: 'Payment method requires a card but no card was provided'
      };
    }

    return { isValid: true };
  }

  /**
   * Initialize default payment methods if they don't exist
   */
  private async initializeDefaultPaymentMethods(): Promise<void> {
    const existingCount = await this.paymentMethodsRepository.getStatistics();

    if (existingCount.total > 0) {
      this.logger.log('Payment methods already exist, skipping initialization');
      return;
    }

    this.logger.log('Initializing default payment methods...');

    try {
      const defaultMethods = DEFAULT_PAYMENT_METHODS.map(pm => ({
        ...pm,
        isActive: true
      }));

      await this.paymentMethodsRepository.bulkCreate(defaultMethods);

      this.logger.log(`Initialized ${defaultMethods.length} default payment methods`);
    } catch (error) {
      this.logger.error('Failed to initialize default payment methods', error);
      throw error;
    }
  }

  /**
   * Seed additional payment methods (for testing or specific requirements)
   */
  async seedPaymentMethods(
    paymentMethods: Array<{
      name: string;
      code: string;
      type: PaymentMethodType;
      requiresCard?: boolean;
      icon?: string;
      sortOrder?: number;
    }>
  ): Promise<PaymentMethodEntity[]> {
    const createdMethods: PaymentMethodEntity[] = [];

    for (const pmData of paymentMethods) {
      try {
        const created = await this.create(pmData);
        createdMethods.push(created);
      } catch (error) {
        this.logger.warn(`Failed to seed payment method ${pmData.code}:`, error.message);
      }
    }

    this.logger.log(`Seeded ${createdMethods.length} payment methods`);
    return createdMethods;
  }
}
