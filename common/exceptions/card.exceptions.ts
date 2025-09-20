import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

export class CardNotFoundException extends BaseException {
  readonly code = 'CARD_NOT_FOUND';
  readonly userMessage = 'The requested card was not found';

  constructor(cardId: string, traceId?: string) {
    super(`Card with ID ${cardId} not found`, HttpStatus.NOT_FOUND, { cardId, traceId });
  }
}

export class CardLimitExceededException extends BaseException {
  readonly code = 'CARD_LIMIT_EXCEEDED';
  readonly userMessage: string;

  constructor(profileType: string, limit: number, traceId?: string) {
    const message = `Card limit exceeded for ${profileType} profile. Maximum ${limit} cards allowed`;
    super(message, HttpStatus.BAD_REQUEST, { profileType, limit, traceId });
    this.userMessage = message;
  }
}

export class InvalidCardOperationException extends BaseException {
  readonly code = 'INVALID_CARD_OPERATION';
  readonly userMessage: string;

  constructor(operation: string, reason: string, traceId?: string) {
    const message = `Cannot ${operation}: ${reason}`;
    super(message, HttpStatus.BAD_REQUEST, { operation, reason, traceId });
    this.userMessage = message;
  }
}

export class CardBalanceUpdateException extends BaseException {
  readonly code = 'CARD_BALANCE_UPDATE_FAILED';
  readonly userMessage = 'Failed to update card balance';

  constructor(cardId: string, reason: string, traceId?: string) {
    super(`Failed to update balance for card ${cardId}: ${reason}`, HttpStatus.BAD_REQUEST, { cardId, reason, traceId });
  }
}

export class DuplicateCardNameException extends BaseException {
  readonly code = 'DUPLICATE_CARD_NAME';
  readonly userMessage = 'A card with this name already exists in your profile';

  constructor(displayName: string, profileId: string, traceId?: string) {
    super(`Card with name '${displayName}' already exists in profile ${profileId}`, HttpStatus.CONFLICT, { displayName, profileId, traceId });
  }
}

export class CardExpiredException extends BaseException {
  readonly code = 'CARD_EXPIRED';
  readonly userMessage = 'This card has expired and cannot be used';

  constructor(cardId: string, expiryDate: string, traceId?: string) {
    super(`Card ${cardId} expired on ${expiryDate}`, HttpStatus.BAD_REQUEST, { cardId, expiryDate, traceId });
  }
}

export class CardInactiveException extends BaseException {
  readonly code = 'CARD_INACTIVE';
  readonly userMessage = 'This card is inactive and cannot be used';

  constructor(cardId: string, status: string, traceId?: string) {
    super(`Card ${cardId} is inactive (status: ${status})`, HttpStatus.BAD_REQUEST, { cardId, status, traceId });
  }
}

export class InvalidCardDataException extends BaseException {
  readonly code = 'INVALID_CARD_DATA';
  readonly userMessage = 'The provided card data is invalid';

  constructor(field: string, reason: string, traceId?: string) {
    super(`Invalid card data for field '${field}': ${reason}`, HttpStatus.BAD_REQUEST, { field, reason, traceId });
  }
}

export class CardOwnershipException extends BaseException {
  readonly code = 'CARD_OWNERSHIP_VIOLATION';
  readonly userMessage = 'You do not have permission to access this card';

  constructor(cardId: string, userId: string, profileId?: string, traceId?: string) {
    super(
      `User ${userId} does not have access to card ${cardId}${profileId ? ` in profile ${profileId}` : ''}`,
      HttpStatus.FORBIDDEN,
      { cardId, userId, profileId, traceId }
    );
  }
}

export class DefaultCardException extends BaseException {
  readonly code = 'DEFAULT_CARD_OPERATION_ERROR';
  readonly userMessage: string;

  constructor(operation: string, reason: string, traceId?: string) {
    const message = `Cannot ${operation} default card: ${reason}`;
    super(message, HttpStatus.BAD_REQUEST, { operation, reason, traceId });
    this.userMessage = message;
  }
}

export class CreditLimitExceededException extends BaseException {
  readonly code = 'CREDIT_LIMIT_EXCEEDED';
  readonly userMessage = 'This transaction would exceed the card\'s credit limit';

  constructor(cardId: string, currentBalance: number, creditLimit: number, transactionAmount: number, traceId?: string) {
    super(
      `Transaction would exceed credit limit for card ${cardId}. Current: ${currentBalance}, Limit: ${creditLimit}, Transaction: ${transactionAmount}`,
      HttpStatus.BAD_REQUEST,
      { cardId, currentBalance, creditLimit, transactionAmount, traceId }
    );
  }
}

export class PaymentMethodNotFoundException extends BaseException {
  readonly code = 'PAYMENT_METHOD_NOT_FOUND';
  readonly userMessage = 'The requested payment method was not found';

  constructor(paymentMethodId: string, traceId?: string) {
    super(`Payment method with ID ${paymentMethodId} not found`, HttpStatus.NOT_FOUND, { paymentMethodId, traceId });
  }
}

export class PaymentMethodCardRequiredException extends BaseException {
  readonly code = 'PAYMENT_METHOD_CARD_REQUIRED';
  readonly userMessage = 'This payment method requires a card to be selected';

  constructor(paymentMethodName: string, traceId?: string) {
    super(`Payment method '${paymentMethodName}' requires a card`, HttpStatus.BAD_REQUEST, { paymentMethodName, traceId });
  }
}

export class InvalidPaymentMethodException extends BaseException {
  readonly code = 'INVALID_PAYMENT_METHOD';
  readonly userMessage = 'The selected payment method is not valid for this operation';

  constructor(paymentMethodId: string, reason: string, traceId?: string) {
    super(`Invalid payment method ${paymentMethodId}: ${reason}`, HttpStatus.BAD_REQUEST, { paymentMethodId, reason, traceId });
  }
}

export class EncryptionException extends BaseException {
  readonly code = 'ENCRYPTION_ERROR';
  readonly userMessage = 'Failed to encrypt or decrypt sensitive data';

  constructor(operation: string, traceId?: string) {
    super(`Encryption operation failed: ${operation}`, HttpStatus.INTERNAL_SERVER_ERROR, { operation, traceId });
  }
}

export class CardBalanceNotFoundException extends BaseException {
  readonly code = 'CARD_BALANCE_NOT_FOUND';
  readonly userMessage = 'Card balance information not found';

  constructor(cardId: string, traceId?: string) {
    super(`Balance not found for card ${cardId}`, HttpStatus.NOT_FOUND, { cardId, traceId });
  }
}

export class InvalidBalanceOperationException extends BaseException {
  readonly code = 'INVALID_BALANCE_OPERATION';
  readonly userMessage = 'The balance operation cannot be completed';

  constructor(operation: string, reason: string, cardId?: string, traceId?: string) {
    super(
      `Invalid balance operation '${operation}': ${reason}${cardId ? ` for card ${cardId}` : ''}`,
      HttpStatus.BAD_REQUEST,
      { operation, reason, cardId, traceId }
    );
  }
}

export class CardDeletionException extends BaseException {
  readonly code = 'CARD_DELETION_ERROR';
  readonly userMessage = 'Cannot delete this card';

  constructor(cardId: string, reason: string, traceId?: string) {
    super(`Cannot delete card ${cardId}: ${reason}`, HttpStatus.BAD_REQUEST, { cardId, reason, traceId });
  }
}