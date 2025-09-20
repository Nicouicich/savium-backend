import { Types } from 'mongoose';
import { CardBrand, CardType, CardStatus } from '@common/constants/card-types';
import { ICard, IMaskedCard } from '../interfaces/card.interface';

export class CardEntity implements ICard {
  _id?: Types.ObjectId;
  userId: string;
  profileId: Types.ObjectId;
  displayName: string;
  lastFourDigits?: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  cardBrand?: CardBrand;
  cardType: CardType;
  issuerBank?: string;
  color?: string;
  icon?: string;
  creditLimit?: number;
  billingCycleDay?: number;
  interestRate?: number;
  annualFee?: number;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  status: CardStatus;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<ICard>) {
    Object.assign(this, data);
  }

  /**
   * Create a masked version of the card for API responses
   */
  toMasked(decryptedLastFour?: string): IMaskedCard {
    return {
      _id: this._id!,
      userId: this.userId,
      profileId: this.profileId,
      displayName: this.displayName,
      lastFourDigits: decryptedLastFour ? `****${decryptedLastFour}` : undefined,
      cardBrand: this.cardBrand,
      cardType: this.cardType,
      issuerBank: this.issuerBank,
      color: this.color,
      icon: this.icon,
      creditLimit: this.creditLimit,
      billingCycleDay: this.billingCycleDay,
      interestRate: this.interestRate,
      annualFee: this.annualFee,
      expiryMonth: this.expiryMonth,
      expiryYear: this.expiryYear,
      isDefault: this.isDefault,
      status: this.status,
      createdAt: this.createdAt!,
      updatedAt: this.updatedAt!
    };
  }

  /**
   * Check if the card is expired
   */
  isExpired(): boolean {
    if (!this.expiryMonth || !this.expiryYear) {
      return false;
    }

    const now = new Date();
    const expiry = new Date(this.expiryYear, this.expiryMonth - 1);

    return now > expiry;
  }

  /**
   * Check if the card is a credit card
   */
  isCreditCard(): boolean {
    return this.cardType === CardType.CREDIT;
  }

  /**
   * Check if the card is active and usable
   */
  isUsable(): boolean {
    return this.status === CardStatus.ACTIVE && !this.isExpired() && !this.deletedAt;
  }

  /**
   * Get a display-friendly card identifier
   */
  getDisplayIdentifier(): string {
    if (this.cardBrand && this.lastFourDigits) {
      return `${this.cardBrand} ending in ${this.lastFourDigits}`;
    }
    return this.displayName;
  }
}
