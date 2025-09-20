import { Types } from 'mongoose';
import { PaymentMethodType } from '@common/constants/card-types';
import { IPaymentMethod } from '../../cards/interfaces/card.interface';

export class PaymentMethodEntity implements IPaymentMethod {
  _id?: Types.ObjectId;
  name: string;
  code: string;
  type: string;
  requiresCard: boolean;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<IPaymentMethod>) {
    Object.assign(this, data);
    this.sortOrder = this.sortOrder ?? 0;
    this.isActive = this.isActive ?? true;
    this.requiresCard = this.requiresCard ?? false;
  }

  /**
   * Check if this payment method is a card type
   */
  isCardType(): boolean {
    return this.type === PaymentMethodType.CARD;
  }

  /**
   * Get display name with icon
   */
  getDisplayName(): string {
    return this.icon ? `${this.icon} ${this.name}` : this.name;
  }

  /**
   * Validate if card is required for this payment method
   */
  validateCardRequirement(hasCard: boolean): boolean {
    if (this.requiresCard && !hasCard) {
      return false;
    }
    return true;
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Omit<IPaymentMethod, '_id'> & { id: string } {
    return {
      id: this._id?.toString() || '',
      name: this.name,
      code: this.code,
      type: this.type,
      requiresCard: this.requiresCard,
      icon: this.icon,
      sortOrder: this.sortOrder,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
