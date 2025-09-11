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

export class ExpenseNotFoundException extends NotFoundResourceException {
  constructor(id: string) {
    super('Expense', id);
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