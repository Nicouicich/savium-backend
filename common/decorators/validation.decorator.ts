import { ValidateIf, ValidationOptions, registerDecorator, ValidationArguments } from 'class-validator';
import { Transform } from 'class-transformer';
import * as validator from 'validator';

// Enhanced financial validation decorators
export function IsMonetaryAmount(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isMonetaryAmount',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'number') return false;
          if (!Number.isFinite(value)) return false;
          if (value < 0) return false;
          if (value > 999999999.99) return false; // Max 999M
          // Check for at most 2 decimal places
          return Number(value.toFixed(2)) === value;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid monetary amount (0-999,999,999.99 with max 2 decimal places)`;
        },
      },
    });
  };
}

export function IsCurrencyCode(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isCurrencyCode',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid 3-letter ISO currency code`;
        },
      },
    });
  };
}

// Enhanced security decorators
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          // At least 8 chars, uppercase, lowercase, number, special char
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must contain at least 8 characters with uppercase, lowercase, number, and special character`;
        },
      },
    });
  };
}

export function IsSafeText(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isSafeText',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          // Block potential XSS patterns
          const dangerousPatterns = [
            /<script/i,
            /<\/script>/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /<iframe/i,
            /<object/i,
            /<embed/i,
            /data:text\/html/i
          ];
          return !dangerousPatterns.some(pattern => pattern.test(value));
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} contains potentially unsafe content`;
        },
      },
    });
  };
}

// Sanitization transforms
export function SanitizeText() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    // Basic HTML entity encoding for safety
    return validator.escape(value.trim());
  });
}

export function SanitizeMonetaryAmount() {
  return Transform(({ value }) => {
    if (typeof value !== 'number') return value;
    // Round to 2 decimal places to prevent precision issues
    return Math.round(value * 100) / 100;
  });
}

// Account name validation
export function IsValidAccountName(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isValidAccountName',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          // Allow letters, numbers, spaces, hyphens, underscores, basic punctuation
          return /^[a-zA-Z0-9\s\-_.,()&']+$/.test(value) && value.trim().length >= 2;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must contain only safe characters and be at least 2 characters long`;
        },
      },
    });
  };
}

// Enhanced email validation with additional security checks
export function IsSecureEmail(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isSecureEmail',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          if (!validator.isEmail(value)) return false;
          // Additional security checks
          if (value.length > 254) return false; // RFC 5321 limit
          const [local, domain] = value.split('@');
          if (local.length > 64) return false; // RFC 5321 limit
          // Block suspicious patterns
          if (/[<>\"']/g.test(value)) return false;
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid and secure email address`;
        },
      },
    });
  };
}

// Rate limiting based on complexity
export function IsValidDescription(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isValidDescription',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return value === undefined; // Allow undefined for optional fields
          if (value.length > 1000) return false; // Reasonable limit
          // Basic XSS protection
          const dangerousPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i];
          return !dangerousPatterns.some(pattern => pattern.test(value));
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a safe description (max 1000 characters)`;
        },
      },
    });
  };
}

// Conditional validation helpers
export const IsOptionalButNotEmpty = (validationOptions?: ValidationOptions) => 
  ValidateIf((object, value) => value !== undefined && value !== null && value !== '', validationOptions);

// MongoDB ObjectId validation
export function IsMongoObjectId(validationOptions?: ValidationOptions) {
  return function (object: Record<string, any>, propertyName: string) {
    registerDecorator({
      name: 'isMongoObjectId',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid MongoDB ObjectId`;
        },
      },
    });
  };
}