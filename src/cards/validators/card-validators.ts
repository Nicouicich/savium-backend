import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, registerDecorator, ValidationOptions } from 'class-validator';
import { Injectable } from '@nestjs/common';

@ValidatorConstraint({ name: 'isUniqueCardName', async: true })
@Injectable()
export class IsUniqueCardNameConstraint implements ValidatorConstraintInterface {
  async validate(displayName: string, args: ValidationArguments): Promise<boolean> {
    // This will be implemented when we have the cards service
    // For now, return true to avoid validation errors during development
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'A card with this name already exists in your account';
  }
}

@ValidatorConstraint({ name: 'isValidCardExpiry', async: false })
export class IsValidCardExpiryConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    const object = args.object as any;
    const expiryMonth = object.expiryMonth;
    const expiryYear = object.expiryYear;

    if (!expiryMonth || !expiryYear) {
      return true; // Let other validators handle required checks
    }

    const now = new Date();
    const expiry = new Date(expiryYear, expiryMonth - 1);

    return expiry > now;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Card expiry date cannot be in the past';
  }
}

@ValidatorConstraint({ name: 'isCreditLimitRequiredForCredit', async: false })
export class IsCreditLimitRequiredForCreditConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    const object = args.object as any;
    const cardType = object.cardType;
    const creditLimit = object.creditLimit;

    if (cardType === 'CREDIT' && (creditLimit === undefined || creditLimit === null)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Credit limit is required for credit cards';
  }
}

// Decorator functions
export function IsUniqueCardName(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUniqueCardNameConstraint
    });
  };
}

export function IsValidCardExpiry(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidCardExpiryConstraint
    });
  };
}

export function IsCreditLimitRequiredForCredit(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCreditLimitRequiredForCreditConstraint
    });
  };
}
