import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  Logger,
  PipeTransform
} from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { SanitizationService } from '../services/sanitization.service';

interface ValidationPipeOptions {
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
  transform?: boolean;
  disableErrorMessages?: boolean;
  validationError?: {
    target?: boolean;
    value?: boolean;
  };
  sanitization?: {
    enabled?: boolean;
    allowEmptyStrings?: boolean;
    maxStringLength?: number;
    allowedTags?: string[];
  };
  security?: {
    enableXSSProtection?: boolean;
    enableSQLInjectionProtection?: boolean;
    enableHTMLInjectionProtection?: boolean;
    maxDepth?: number;
    maxArraySize?: number;
    maxObjectKeys?: number;
  };
}

@Injectable()
export class EnhancedValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(EnhancedValidationPipe.name);

  constructor(
    private readonly sanitizationService: SanitizationService,
    private readonly options: ValidationPipeOptions = {}
  ) {
    // Set default options
    this.options = {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      sanitization: {
        enabled: true,
        allowEmptyStrings: false,
        maxStringLength: 10000,
        allowedTags: [],
        ...options.sanitization
      },
      security: {
        enableXSSProtection: true,
        enableSQLInjectionProtection: true,
        enableHTMLInjectionProtection: true,
        maxDepth: 10,
        maxArraySize: 1000,
        maxObjectKeys: 100,
        ...options.security
      },
      ...options
    };
  }

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    const { metatype } = metadata;

    // Skip validation for primitive types and built-in objects
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    try {
      // Step 1: Security validation
      this.performSecurityValidation(value);

      // Step 2: Deep sanitization
      if (this.options.sanitization?.enabled) {
        value = await this.performDeepSanitization(value);
      }

      // Step 3: Transform to class instance
      const object = plainToClass(metatype, value, {
        enableImplicitConversion: this.options.transform,
        excludeExtraneousValues: this.options.whitelist
      });

      // Step 4: Validate with class-validator
      const errors = await validate(object, {
        whitelist: this.options.whitelist,
        forbidNonWhitelisted: this.options.forbidNonWhitelisted,
        validationError: this.options.validationError
      });

      if (errors.length > 0) {
        throw new BadRequestException(this.createErrorMessage(errors));
      }

      return object;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Validation error:', error);
      throw new BadRequestException('Validation failed');
    }
  }

  private toValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private performSecurityValidation(value: any, depth = 0): void {
    const { security } = this.options;

    // Check maximum depth to prevent deeply nested attacks
    if (depth > (security?.maxDepth || 10)) {
      throw new BadRequestException('Input data is too deeply nested');
    }

    if (Array.isArray(value)) {
      // Check array size
      if (value.length > (security?.maxArraySize || 1000)) {
        throw new BadRequestException('Array size exceeds maximum allowed limit');
      }

      // Validate each array element
      value.forEach(item => this.performSecurityValidation(item, depth + 1));
      return;
    }

    if (value && typeof value === 'object') {
      const keys = Object.keys(value);

      // Check object key count
      if (keys.length > (security?.maxObjectKeys || 100)) {
        throw new BadRequestException('Object has too many properties');
      }

      // Validate each object property
      keys.forEach(key => {
        // Check for potentially dangerous property names
        if (this.isDangerousPropertyName(key)) {
          throw new BadRequestException(`Dangerous property name detected: ${key}`);
        }

        this.performSecurityValidation(value[key], depth + 1);
      });
      return;
    }

    if (typeof value === 'string') {
      // Check string length
      if (value.length > (this.options.sanitization?.maxStringLength || 10000)) {
        throw new BadRequestException('String value exceeds maximum allowed length');
      }

      // Check for potential attacks
      if (security?.enableXSSProtection && this.containsXSSAttempt(value)) {
        throw new BadRequestException('Potential XSS attack detected');
      }

      if (security?.enableSQLInjectionProtection && this.containsSQLInjection(value)) {
        throw new BadRequestException('Potential SQL injection detected');
      }

      if (security?.enableHTMLInjectionProtection && this.containsHTMLInjection(value)) {
        throw new BadRequestException('Potential HTML injection detected');
      }
    }
  }

  private async performDeepSanitization(value: any): Promise<any> {
    if (Array.isArray(value)) {
      return Promise.all(value.map(item => this.performDeepSanitization(item)));
    }

    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = await this.performDeepSanitization(val);
      }
      return sanitized;
    }

    if (typeof value === 'string') {
      // Use the sanitization service for string values
      let sanitized = await this.sanitizationService.sanitizeHtml(value);
      sanitized = this.sanitizationService.removeXSSAttempts(sanitized);
      sanitized = this.sanitizationService.sanitizeSQL(sanitized);

      // Trim and normalize whitespace
      sanitized = sanitized.trim().replace(/\s+/g, ' ');

      // Handle empty strings
      if (!this.options.sanitization?.allowEmptyStrings && sanitized === '') {
        return undefined;
      }

      return sanitized;
    }

    return value;
  }

  private isDangerousPropertyName(key: string): boolean {
    const dangerousPatterns = [
      /^(__proto__|constructor|prototype)$/i,
      /^(eval|function|script)$/i,
      /^(on\w+)$/i, // Event handlers like onclick, onload
      /^\$\$/, // Angular internal properties
      /_\w+_/ // Potential framework internal properties
    ];

    return dangerousPatterns.some(pattern => pattern.test(key));
  }

  private containsXSSAttempt(value: string): boolean {
    const xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
      /<object[\s\S]*?>[\s\S]*?<\/object>/gi,
      /<embed[\s\S]*?>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /on\w+\s*=/gi,
      /<img[\s\S]*?src[\s\S]*?onerror[\s\S]*?>/gi,
      /<svg[\s\S]*?>[\s\S]*?<\/svg>/gi
    ];

    return xssPatterns.some(pattern => pattern.test(value));
  }

  private containsSQLInjection(value: string): boolean {
    const sqlPatterns = [
      /(\bUNION\b[\s\S]*?\bSELECT\b)/gi,
      /(\bSELECT\b[\s\S]*?\bFROM\b)/gi,
      /(\bINSERT\b[\s\S]*?\bINTO\b)/gi,
      /(\bUPDATE\b[\s\S]*?\bSET\b)/gi,
      /(\bDELETE\b[\s\S]*?\bFROM\b)/gi,
      /(\bDROP\b[\s\S]*?\bTABLE\b)/gi,
      /(\bCREATE\b[\s\S]*?\bTABLE\b)/gi,
      /(\bALTER\b[\s\S]*?\bTABLE\b)/gi,
      /(\bEXEC\b[\s\S]*?\b)/gi,
      /(\bEXECUTE\b[\s\S]*?\b)/gi,
      /(--[\s\S]*)/g,
      /(\/\*[\s\S]*?\*\/)/g,
      /(\bOR\b[\s\S]*?=[\s\S]*?\bOR\b)/gi,
      /(\bAND\b[\s\S]*?=[\s\S]*?\bAND\b)/gi,
      /('[\s\S]*?'[\s\S]*?=[\s\S]*?'[\s\S]*?')/g
    ];

    return sqlPatterns.some(pattern => pattern.test(value));
  }

  private containsHTMLInjection(value: string): boolean {
    const htmlPatterns = [
      /<[^>]*>/g,
      /&lt;[^&gt;]*&gt;/g,
      /&#\d+;/g,
      /&#x[0-9a-f]+;/gi,
      /&\w+;/g
    ];

    // Allow basic safe HTML entities
    const safeEntities = ['&amp;', '&lt;', '&gt;', '&quot;', '&#39;'];
    let testValue = value;

    safeEntities.forEach(entity => {
      testValue = testValue.replace(new RegExp(entity, 'g'), '');
    });

    return htmlPatterns.some(pattern => pattern.test(testValue));
  }

  private createErrorMessage(errors: ValidationError[]): string | object {
    if (this.options.disableErrorMessages) {
      return 'Validation failed';
    }

    const formatError = (error: ValidationError): any => {
      const result: any = {};

      if (error.constraints) {
        result.constraints = Object.values(error.constraints);
      }

      if (error.children && error.children.length > 0) {
        result.children = {};
        error.children.forEach(child => {
          result.children[child.property] = formatError(child);
        });
      }

      return result;
    };

    const formattedErrors: any = {};
    errors.forEach(error => {
      formattedErrors[error.property] = formatError(error);
    });

    return {
      message: 'Validation failed',
      errors: formattedErrors
    };
  }
}
