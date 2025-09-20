export enum CardBrand {
  VISA = 'VISA',
  MASTERCARD = 'MASTERCARD',
  AMEX = 'AMEX',
  DISCOVER = 'DISCOVER',
  OTHER = 'OTHER'
}

export enum CardType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  PREPAID = 'PREPAID'
}

export enum CardStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
  BLOCKED = 'BLOCKED',
  PENDING = 'PENDING'
}

export enum PaymentMethodType {
  CARD = 'CARD',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
  CHECK = 'CHECK',
  OTHER = 'OTHER'
}

export enum BalanceUpdateSource {
  MANUAL = 'MANUAL',
  API = 'API',
  CALCULATED = 'CALCULATED'
}

export enum StatsPeriod {
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR'
}

// Card limits per account type
export const CARD_LIMITS_BY_ACCOUNT_TYPE = {
  personal: 10,
  couple: 15,
  family: 20,
  business: 25
} as const;

// Default payment methods that should be created on system initialization
export const DEFAULT_PAYMENT_METHODS = [
  {
    name: 'Cash',
    code: 'CASH',
    type: PaymentMethodType.CASH,
    requiresCard: false,
    icon: '💵',
    sortOrder: 1
  },
  {
    name: 'Credit Card',
    code: 'CREDIT_CARD',
    type: PaymentMethodType.CARD,
    requiresCard: true,
    icon: '💳',
    sortOrder: 2
  },
  {
    name: 'Debit Card',
    code: 'DEBIT_CARD',
    type: PaymentMethodType.CARD,
    requiresCard: true,
    icon: '💳',
    sortOrder: 3
  },
  {
    name: 'Bank Transfer',
    code: 'BANK_TRANSFER',
    type: PaymentMethodType.BANK_TRANSFER,
    requiresCard: false,
    icon: '🏦',
    sortOrder: 4
  },
  {
    name: 'Digital Wallet',
    code: 'DIGITAL_WALLET',
    type: PaymentMethodType.DIGITAL_WALLET,
    requiresCard: false,
    icon: '📱',
    sortOrder: 5
  },
  {
    name: 'Check',
    code: 'CHECK',
    type: PaymentMethodType.CHECK,
    requiresCard: false,
    icon: '📝',
    sortOrder: 6
  }
] as const;
