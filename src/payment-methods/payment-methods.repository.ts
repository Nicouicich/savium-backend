import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentMethod, PaymentMethodDocument } from './schemas/payment-method.schema';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import { IPaymentMethod } from '../cards/interfaces/card.interface';
import { PaymentMethodType } from '@common/constants/card-types';

@Injectable()
export class PaymentMethodsRepository {
  constructor(
    @InjectModel(PaymentMethod.name)
    private readonly paymentMethodModel: Model<PaymentMethodDocument>
  ) {}

  /**
   * Create a new payment method
   */
  async create(paymentMethodData: Partial<PaymentMethod>): Promise<PaymentMethodEntity> {
    const createdPaymentMethod = new this.paymentMethodModel(paymentMethodData);
    const saved = await createdPaymentMethod.save();
    return new PaymentMethodEntity(saved.toObject() as unknown as IPaymentMethod);
  }

  /**
   * Find all active payment methods, sorted by sortOrder
   */
  async findAllActive(): Promise<PaymentMethodEntity[]> {
    const paymentMethods = await this.paymentMethodModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean().exec();

    return paymentMethods.map(pm => new PaymentMethodEntity(pm as unknown as IPaymentMethod));
  }

  /**
   * Find all payment methods (including inactive)
   */
  async findAll(): Promise<PaymentMethodEntity[]> {
    const paymentMethods = await this.paymentMethodModel.find({}).sort({ sortOrder: 1, name: 1 }).lean().exec();

    return paymentMethods.map(pm => new PaymentMethodEntity(pm as unknown as IPaymentMethod));
  }

  /**
   * Find payment method by ID
   */
  async findById(id: string): Promise<PaymentMethodEntity | null> {
    const paymentMethod = await this.paymentMethodModel.findById(id).lean().exec();

    return paymentMethod ? new PaymentMethodEntity(paymentMethod as unknown as IPaymentMethod) : null;
  }

  /**
   * Find payment method by code
   */
  async findByCode(code: string): Promise<PaymentMethodEntity | null> {
    const paymentMethod = await this.paymentMethodModel.findOne({ code: code.toUpperCase() }).lean().exec();

    return paymentMethod ? new PaymentMethodEntity(paymentMethod as unknown as IPaymentMethod) : null;
  }

  /**
   * Find payment methods by type
   */
  async findByType(type: PaymentMethodType): Promise<PaymentMethodEntity[]> {
    const paymentMethods = await this.paymentMethodModel.find({ type, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean().exec();

    return paymentMethods.map(pm => new PaymentMethodEntity(pm as unknown as IPaymentMethod));
  }

  /**
   * Find payment methods that require cards
   */
  async findCardRequiredMethods(): Promise<PaymentMethodEntity[]> {
    const paymentMethods = await this.paymentMethodModel.find({ requiresCard: true, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean().exec();

    return paymentMethods.map(pm => new PaymentMethodEntity(pm as unknown as IPaymentMethod));
  }

  /**
   * Update payment method
   */
  async update(id: string, updateData: Partial<PaymentMethod>): Promise<PaymentMethodEntity | null> {
    const updated = await this.paymentMethodModel.findByIdAndUpdate(id, updateData, { new: true }).lean().exec();

    return updated ? new PaymentMethodEntity(updated as unknown as IPaymentMethod) : null;
  }

  /**
   * Update sort orders for multiple payment methods
   */
  async updateSortOrders(sortUpdates: Array<{ id: string; sortOrder: number }>): Promise<void> {
    const bulkOps = sortUpdates.map(update => ({
      updateOne: {
        filter: { _id: update.id },
        update: { sortOrder: update.sortOrder }
      }
    }));

    await this.paymentMethodModel.bulkWrite(bulkOps);
  }

  /**
   * Activate/deactivate payment method
   */
  async updateStatus(id: string, isActive: boolean): Promise<PaymentMethodEntity | null> {
    const updated = await this.paymentMethodModel.findByIdAndUpdate(id, { isActive }, { new: true }).lean().exec();

    return updated ? new PaymentMethodEntity(updated as unknown as IPaymentMethod) : null;
  }

  /**
   * Delete payment method
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.paymentMethodModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Check if code exists
   */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    const query: any = { code: code.toUpperCase() };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const count = await this.paymentMethodModel.countDocuments(query).exec();
    return count > 0;
  }

  /**
   * Get next sort order
   */
  async getNextSortOrder(): Promise<number> {
    const lastPaymentMethod = await this.paymentMethodModel.findOne({}).sort({ sortOrder: -1 }).select('sortOrder').lean().exec();

    return lastPaymentMethod ? lastPaymentMethod.sortOrder + 1 : 1;
  }

  /**
   * Bulk create payment methods (for seeding)
   */
  async bulkCreate(paymentMethods: Partial<PaymentMethod>[]): Promise<PaymentMethodEntity[]> {
    const created = await this.paymentMethodModel.insertMany(paymentMethods);
    return created.map(pm => new PaymentMethodEntity(pm.toObject() as unknown as IPaymentMethod));
  }

  /**
   * Get payment method statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    byType: Record<PaymentMethodType, number>;
  }> {
    const [total, active, byType] = await Promise.all([
      this.paymentMethodModel.countDocuments({}).exec(),
      this.paymentMethodModel.countDocuments({ isActive: true }).exec(),
      this.paymentMethodModel.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]).exec()
    ]);

    const typeStats = byType.reduce(
      (acc, item) => {
        acc[item._id as PaymentMethodType] = item.count;
        return acc;
      },
      {} as Record<PaymentMethodType, number>
    );

    return {
      total,
      active,
      byType: typeStats
    };
  }
}
