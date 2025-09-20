import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

export class ValidationException extends BaseException {
  readonly code = 'VALIDATION_ERROR';
  readonly userMessage = 'The provided data is invalid';

  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, context);
  }
}

export class NotFoundResourceException extends BaseException {
  readonly code = 'RESOURCE_NOT_FOUND';
  readonly userMessage = 'The requested resource was not found';

  constructor(resource: string, id?: string) {
    super(`${resource} not found${id ? ` with id: ${id}` : ''}`, HttpStatus.NOT_FOUND, { resource, id });
  }
}

export class UnauthorizedAccessException extends BaseException {
  readonly code = 'UNAUTHORIZED_ACCESS';
  readonly userMessage = 'You are not authorized to perform this action';

  constructor(action?: string, resource?: string) {
    super(`Unauthorized access${action ? ` to ${action}` : ''}${resource ? ` on ${resource}` : ''}`, HttpStatus.FORBIDDEN, { action, resource });
  }
}

export class BusinessLogicException extends BaseException {
  readonly code = 'BUSINESS_LOGIC_ERROR';
  readonly userMessage = 'This operation cannot be completed due to business rules';

  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, context);
  }
}

export class TransactionNotFoundException extends NotFoundResourceException {
  constructor(id: string) {
    super('Transaction', id);
  }
}

export class AccountNotFoundException extends NotFoundResourceException {
  constructor(id: string) {
    super('Account', id);
  }
}

export class UserNotFoundException extends NotFoundResourceException {
  constructor(id: string) {
    super('User', id);
  }
}

export class InsufficientPermissionsException extends BaseException {
  readonly code = 'INSUFFICIENT_PERMISSIONS';
  readonly userMessage: string;

  constructor(action: string, resource: string) {
    const message = `You don't have permission to ${action} ${resource}`;
    super(`Unauthorized access to ${action} on ${resource}`, HttpStatus.FORBIDDEN, { action, resource });
    this.userMessage = message;
  }
}

export class InvalidFileTypeException extends BaseException {
  readonly code = 'INVALID_FILE_TYPE';
  readonly userMessage = 'The uploaded file type is not allowed';

  constructor(allowedTypes: string[]) {
    super(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`, HttpStatus.BAD_REQUEST, { allowedTypes });
  }
}

export class FileSizeExceededException extends BaseException {
  readonly code = 'FILE_SIZE_EXCEEDED';
  readonly userMessage = 'The uploaded file is too large';

  constructor(maxSize: number, actualSize: number) {
    super(`File size ${actualSize} exceeds maximum allowed size of ${maxSize}`, HttpStatus.PAYLOAD_TOO_LARGE, { maxSize, actualSize });
  }
}

// Referral System Exceptions
export class InvalidReferralCodeException extends BaseException {
  readonly code = 'INVALID_REFERRAL_CODE';
  readonly userMessage = 'The referral code is invalid or does not exist';

  constructor(code: string) {
    super(`Invalid referral code: ${code}`, HttpStatus.BAD_REQUEST, { code });
  }
}

export class SelfReferralException extends BaseException {
  readonly code = 'SELF_REFERRAL_NOT_ALLOWED';
  readonly userMessage = 'You cannot use your own referral code';

  constructor() {
    super('Self-referral is not allowed', HttpStatus.BAD_REQUEST);
  }
}

export class AlreadyReferredException extends BaseException {
  readonly code = 'ALREADY_REFERRED';
  readonly userMessage = 'You have already been referred by another user';

  constructor() {
    super('User has already been referred', HttpStatus.CONFLICT);
  }
}

export class ReferralNotFoundException extends NotFoundResourceException {
  constructor(id: string) {
    super('Referral', id);
  }
}

export class RewardNotFoundException extends NotFoundResourceException {
  constructor(id: string) {
    super('Referral Reward', id);
  }
}

export class RewardNotAvailableException extends BaseException {
  readonly code = 'REWARD_NOT_AVAILABLE';
  readonly userMessage = 'This reward is not available for redemption';

  constructor(rewardId: string, status: string) {
    super(`Reward ${rewardId} is not available (status: ${status})`, HttpStatus.CONFLICT, { rewardId, status });
  }
}

export class InsufficientRewardsException extends BaseException {
  readonly code = 'INSUFFICIENT_REWARDS';
  readonly userMessage = 'You do not have enough rewards to complete this redemption';

  constructor(available: number, requested: number) {
    super(`Insufficient rewards: available ${available}, requested ${requested}`, HttpStatus.BAD_REQUEST, { available, requested });
  }
}

export class ReferralCompletionException extends BaseException {
  readonly code = 'REFERRAL_COMPLETION_ERROR';
  readonly userMessage = 'Unable to complete the referral process';

  constructor(reason: string) {
    super(`Referral completion failed: ${reason}`, HttpStatus.UNPROCESSABLE_ENTITY, { reason });
  }
}

export class DuplicateReferralCodeException extends BaseException {
  readonly code = 'DUPLICATE_REFERRAL_CODE';
  readonly userMessage = 'This referral code is already in use';

  constructor(code: string) {
    super(`Referral code already exists: ${code}`, HttpStatus.CONFLICT, { code });
  }
}

// Re-export card-specific exceptions
export * from './card.exceptions';
