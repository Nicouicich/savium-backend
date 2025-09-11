import { Injectable } from '@nestjs/common';
import * as validator from 'validator';
import { MonetaryAmount, CurrencyCode, UserEmail, PlainTextPassword, createMonetaryAmount, createCurrencyCode, createUserEmail, createPlainTextPassword } from '../../src/types/branded';

@Injectable()
export class SanitizationService {
  
  /**
   * Sanitize text input to prevent XSS attacks
   */
  sanitizeText(input: string): string {
    if (typeof input !== 'string') return '';
    
    // Trim whitespace
    let sanitized = input.trim();
    
    // HTML encode dangerous characters
    sanitized = validator.escape(sanitized);
    
    // Remove or encode potentially dangerous patterns
    sanitized = sanitized.replace(/javascript:/gi, 'javascript-');
    sanitized = sanitized.replace(/data:text\/html/gi, 'data-text-html');
    sanitized = sanitized.replace(/vbscript:/gi, 'vbscript-');
    
    return sanitized;
  }

  /**
   * Sanitize and validate monetary amounts
   */
  sanitizeMonetaryAmount(input: number | string): MonetaryAmount | null {
    let amount: number;
    
    if (typeof input === 'string') {
      // Remove currency symbols and whitespace
      const cleanInput = input.replace(/[$,\s]/g, '');
      amount = parseFloat(cleanInput);
    } else if (typeof input === 'number') {
      amount = input;
    } else {
      return null;
    }

    // Validate the amount
    if (!Number.isFinite(amount) || amount < 0 || amount > 999999999.99) {
      return null;
    }

    // Round to 2 decimal places to prevent precision issues
    const roundedAmount = Math.round(amount * 100) / 100;
    
    return createMonetaryAmount(roundedAmount);
  }

  /**
   * Validate and sanitize currency codes
   */
  sanitizeCurrencyCode(input: string): CurrencyCode | null {
    if (typeof input !== 'string') return null;
    
    const cleaned = input.trim().toUpperCase();
    
    // Validate ISO 4217 format
    if (!/^[A-Z]{3}$/.test(cleaned)) {
      return null;
    }
    
    // List of common valid currency codes (could be extended)
    const validCurrencies = [
      'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NZD',
      'MXN', 'SGD', 'HKD', 'NOK', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR', 'KRW'
    ];
    
    if (!validCurrencies.includes(cleaned)) {
      return null; // Could be relaxed to allow all valid ISO codes
    }
    
    return createCurrencyCode(cleaned);
  }

  /**
   * Sanitize and validate email addresses
   */
  sanitizeEmail(input: string): UserEmail | null {
    if (typeof input !== 'string') return null;
    
    const cleaned = input.trim().toLowerCase();
    
    // Basic validation
    if (!validator.isEmail(cleaned)) return null;
    
    // Additional security checks
    if (cleaned.length > 254) return null; // RFC 5321 limit
    
    const [local, domain] = cleaned.split('@');
    if (local.length > 64) return null; // RFC 5321 limit
    
    // Block suspicious patterns
    if (/[<>\"']/g.test(cleaned)) return null;
    
    return createUserEmail(cleaned);
  }

  /**
   * Validate password strength without storing plaintext
   */
  validatePassword(input: string): PlainTextPassword | null {
    if (typeof input !== 'string') return null;
    
    // Check length
    if (input.length < 8 || input.length > 128) return null;
    
    // Check complexity requirements
    const hasLowercase = /[a-z]/.test(input);
    const hasUppercase = /[A-Z]/.test(input);
    const hasNumber = /\d/.test(input);
    const hasSpecialChar = /[@$!%*?&]/.test(input);
    
    if (!hasLowercase || !hasUppercase || !hasNumber || !hasSpecialChar) {
      return null;
    }
    
    // Check for common weak patterns
    const commonWeakPatterns = [
      /password/i,
      /123456/,
      /qwerty/i,
      /admin/i,
      /login/i
    ];
    
    if (commonWeakPatterns.some(pattern => pattern.test(input))) {
      return null;
    }
    
    return createPlainTextPassword(input);
  }

  /**
   * Sanitize account names and descriptions
   */
  sanitizeAccountName(input: string): string | null {
    if (typeof input !== 'string') return null;
    
    const cleaned = input.trim();
    
    if (cleaned.length < 2 || cleaned.length > 100) return null;
    
    // Allow letters, numbers, spaces, and safe punctuation
    if (!/^[a-zA-Z0-9\s\-_.,()&']+$/.test(cleaned)) return null;
    
    return validator.escape(cleaned);
  }

  /**
   * Sanitize descriptions with length limits
   */
  sanitizeDescription(input: string, maxLength = 1000): string | null {
    if (typeof input !== 'string') return null;
    
    const cleaned = input.trim();
    
    if (cleaned.length > maxLength) return null;
    
    // Basic XSS protection
    const dangerousPatterns = [
      /<script/i,
      /<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];
    
    if (dangerousPatterns.some(pattern => pattern.test(cleaned))) {
      return null;
    }
    
    return validator.escape(cleaned);
  }

  /**
   * Sanitize file names for secure file handling
   */
  sanitizeFileName(input: string): string | null {
    if (typeof input !== 'string') return null;
    
    const cleaned = input.trim();
    
    // Remove directory traversal attempts
    let sanitized = cleaned.replace(/\.\./g, '');
    sanitized = sanitized.replace(/[\/\\]/g, '');
    
    // Allow only alphanumeric, dots, hyphens, and underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9.-_]/g, '');
    
    // Ensure it doesn't start with a dot
    sanitized = sanitized.replace(/^\.+/, '');
    
    if (sanitized.length === 0 || sanitized.length > 255) return null;
    
    return sanitized;
  }

  /**
   * Sanitize timezone strings
   */
  sanitizeTimezone(input: string): string | null {
    if (typeof input !== 'string') return null;
    
    const cleaned = input.trim();
    
    // Basic timezone format validation (could be enhanced with actual timezone list)
    if (!/^[A-Za-z_\/]+$/.test(cleaned)) return null;
    
    if (cleaned.length > 50) return null;
    
    return cleaned;
  }

  /**
   * Remove sensitive information from objects for logging
   */
  sanitizeForLogging(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'auth', 'credential',
      'refreshToken', 'accessToken', 'jwt', 'authorization'
    ];
    
    const sanitized = { ...obj };
    
    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeForLogging(sanitized[key]);
      }
    }
    
    return sanitized;
  }

  /**
   * Validate and sanitize pagination parameters
   */
  sanitizePaginationParams(page?: number, limit?: number): { page: number; limit: number } {
    const sanitizedPage = Math.max(1, Math.floor(Math.abs(page || 1)));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(Math.abs(limit || 10))));
    
    return { page: sanitizedPage, limit: sanitizedLimit };
  }

  /**
   * Validate MongoDB ObjectId format
   */
  isValidObjectId(id: string): boolean {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Rate limiting: Extract and sanitize IP addresses
   */
  sanitizeIpAddress(req: any): string {
    // Try to get real IP from headers (in case of proxies)
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || req.ip || req.connection.remoteAddress;
    
    // Basic IP validation
    if (typeof ip !== 'string') return 'unknown';
    
    // Remove any suspicious content
    return ip.replace(/[^0-9a-f:.]/gi, '').substring(0, 45); // Max length for IPv6
  }

  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  sanitizeHtml(input: string): string {
    if (typeof input !== 'string') return '';
    
    // Basic HTML sanitization - escapes all HTML entities
    let sanitized = validator.escape(input);
    
    // Remove or neutralize dangerous HTML patterns
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    sanitized = sanitized.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
    sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');
    
    // Remove dangerous attributes
    sanitized = sanitized.replace(/\son\w+\s*=\s*[^>]*/gi, ''); // Remove event handlers
    sanitized = sanitized.replace(/javascript:/gi, 'javascript-'); // Neutralize javascript: URLs
    sanitized = sanitized.replace(/data:text\/html/gi, 'data-text-html'); // Neutralize data URLs
    
    return sanitized;
  }

  /**
   * Remove XSS attempts from input
   */
  removeXSSAttempts(input: string): string {
    if (typeof input !== 'string') return '';
    
    let cleaned = input;
    
    // Remove script tags and their content
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove dangerous HTML tags
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option'];
    dangerousTags.forEach(tag => {
      const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, 'gi');
      cleaned = cleaned.replace(regex, '');
      // Also remove self-closing versions
      const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi');
      cleaned = cleaned.replace(selfClosingRegex, '');
    });
    
    // Remove event handlers
    cleaned = cleaned.replace(/\son\w+\s*=\s*[^>\s]*/gi, '');
    
    // Remove javascript: and data: URLs
    cleaned = cleaned.replace(/javascript:/gi, '');
    cleaned = cleaned.replace(/data:(?:text\/html|application\/javascript)/gi, 'data-blocked');
    
    // Remove CSS expressions
    cleaned = cleaned.replace(/expression\s*\(/gi, 'expression-(');
    cleaned = cleaned.replace(/@import/gi, '@import-blocked');
    
    return cleaned.trim();
  }

  /**
   * Sanitize SQL input to prevent SQL injection
   */
  sanitizeSQL(input: string): string {
    if (typeof input !== 'string') return '';
    
    let sanitized = input.trim();
    
    // Remove or neutralize SQL injection patterns
    const sqlPatterns = [
      /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE){0,1}|INSERT( +INTO){0,1}|MERGE|SELECT|UPDATE|UNION( +ALL){0,1})\b)/gi,
      /(;|\||`|\/\*|\*\/|xp_)/gi,
      /(\b(AND|OR)\b.*(=|>|<|!=|<>|LIKE))/gi,
      /('|(\\)*")/gi, // Remove quotes
      /(--|\#)/g, // Remove SQL comments
    ];
    
    sqlPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    // Escape remaining special characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
    sanitized = sanitized.replace(/[\\"']/g, ''); // Remove quotes
    
    return sanitized;
  }
}