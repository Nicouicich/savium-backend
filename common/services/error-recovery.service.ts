import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ErrorPattern {
  name: string;
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  retryable: boolean;
  recoveryAction?: (error: Error, context?: any) => Promise<any>;
}

export enum ErrorCategory {
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  SYSTEM = 'SYSTEM',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorAnalysis {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  retryable: boolean;
  suggestedAction: string;
  context: Record<string, any>;
}

export interface RecoveryStrategy {
  name: string;
  applicable: (error: Error, analysis: ErrorAnalysis) => boolean;
  execute: (error: Error, context?: any) => Promise<any>;
  fallback?: (error: Error, context?: any) => Promise<any>;
}

@Injectable()
export class ErrorRecoveryService {
  private readonly logger = new Logger(ErrorRecoveryService.name);
  private readonly errorPatterns: ErrorPattern[] = [];
  private readonly recoveryStrategies: RecoveryStrategy[] = [];

  constructor(private configService: ConfigService) {
    this.initializeErrorPatterns();
    this.initializeRecoveryStrategies();
  }

  /**
   * Analyze an error and determine its category, severity, and recoverability
   */
  analyzeError(error: Error, context?: Record<string, any>): ErrorAnalysis {
    // Find matching pattern
    const matchedPattern = this.errorPatterns.find(pattern =>
      pattern.pattern.test(error.message)
      || pattern.pattern.test(error.name)
      || (error.stack && pattern.pattern.test(error.stack))
    );

    if (matchedPattern) {
      return {
        category: matchedPattern.category,
        severity: matchedPattern.severity,
        recoverable: matchedPattern.recoverable,
        retryable: matchedPattern.retryable,
        suggestedAction: this.getSuggestedAction(matchedPattern),
        context: context || {}
      };
    }

    // Default analysis for unknown errors
    return {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      recoverable: false,
      retryable: false,
      suggestedAction: 'Log error and monitor',
      context: context || {}
    };
  }

  /**
   * Attempt to recover from an error using appropriate strategies
   */
  async attemptRecovery(
    error: Error,
    context?: Record<string, any>
  ): Promise<{ recovered: boolean; result?: any; fallbackUsed?: boolean }> {
    const analysis = this.analyzeError(error, context);

    this.logger.warn(`Attempting recovery for error`, {
      errorName: error.name,
      errorMessage: error.message,
      category: analysis.category,
      severity: analysis.severity,
      recoverable: analysis.recoverable
    });

    if (!analysis.recoverable) {
      return { recovered: false };
    }

    // Find applicable recovery strategies
    const applicableStrategies = this.recoveryStrategies.filter(strategy => strategy.applicable(error, analysis));

    // Try each strategy in order
    for (const strategy of applicableStrategies) {
      try {
        this.logger.debug(`Trying recovery strategy: ${strategy.name}`);
        const result = await strategy.execute(error, context);

        this.logger.log(`Recovery successful using strategy: ${strategy.name}`);
        return { recovered: true, result };
      } catch (recoveryError) {
        this.logger.warn(`Recovery strategy ${strategy.name} failed:`, recoveryError);

        // Try fallback if available
        if (strategy.fallback) {
          try {
            const fallbackResult = await strategy.fallback(error, context);
            this.logger.log(`Fallback successful for strategy: ${strategy.name}`);
            return { recovered: true, result: fallbackResult, fallbackUsed: true };
          } catch (fallbackError) {
            this.logger.warn(`Fallback also failed for strategy: ${strategy.name}`, fallbackError);
          }
        }
      }
    }

    return { recovered: false };
  }

  /**
   * Execute operation with automatic error recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context?: Record<string, any>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const recovery = await this.attemptRecovery(lastError, {
            ...context,
            attempt,
            maxRetries
          });

          if (recovery.recovered) {
            // If recovery returned a result, use it
            if (recovery.result !== undefined) {
              return recovery.result;
            }

            // Otherwise, try the operation again
            continue;
          }

          // Check if error is retryable
          const analysis = this.analyzeError(lastError, context);
          if (analysis.retryable) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            this.logger.debug(`Retrying operation in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // If we reach here, recovery failed and we should throw the original error
        throw lastError;
      }
    }

    throw lastError!;
  }

  /**
   * Handle database errors with specific recovery strategies
   */
  async handleDatabaseError(
    error: Error,
    operation: () => Promise<any>,
    context?: Record<string, any>
  ): Promise<any> {
    const analysis = this.analyzeError(error, context);

    if (analysis.category === ErrorCategory.DATABASE) {
      // Database-specific recovery strategies
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        this.logger.warn('Database connection issue detected, attempting recovery');

        // Wait and retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          return await operation();
        } catch (retryError) {
          this.logger.error('Database retry failed', retryError);
          throw retryError;
        }
      }
    }

    throw error;
  }

  /**
   * Handle network errors with retry logic
   */
  async handleNetworkError(
    error: Error,
    operation: () => Promise<any>,
    maxRetries = 3
  ): Promise<any> {
    if (this.isNetworkError(error)) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000; // Jittered backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          return await operation();
        } catch (retryError) {
          if (attempt === maxRetries - 1) {
            throw retryError;
          }
        }
      }
    }

    throw error;
  }

  /**
   * Handle external service errors
   */
  async handleExternalServiceError(
    serviceName: string,
    error: Error,
    fallbackData?: any
  ): Promise<any> {
    this.logger.warn(`External service ${serviceName} error:`, error);

    const analysis = this.analyzeError(error);

    if (analysis.category === ErrorCategory.EXTERNAL_SERVICE) {
      // Try to use cached data if available
      if (fallbackData) {
        this.logger.log(`Using fallback data for ${serviceName}`);
        return fallbackData;
      }

      // For rate limiting, implement exponential backoff
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        const delay = 60000; // 1 minute delay for rate limiting
        this.logger.warn(`Rate limit detected for ${serviceName}, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        throw error; // Let the caller retry
      }
    }

    throw error;
  }

  /**
   * Get error recovery statistics
   */
  getRecoveryStats(): {
    totalRecoveryAttempts: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    recoveryRate: number;
    strategiesUsed: Record<string, number>;
  } {
    // This would be implemented with actual metrics collection
    return {
      totalRecoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      recoveryRate: 0,
      strategiesUsed: {}
    };
  }

  /**
   * Add custom error pattern
   */
  addErrorPattern(pattern: ErrorPattern): void {
    this.errorPatterns.push(pattern);
    this.logger.debug(`Added custom error pattern: ${pattern.name}`);
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.logger.debug(`Added custom recovery strategy: ${strategy.name}`);
  }

  /**
   * Initialize default error patterns
   */
  private initializeErrorPatterns(): void {
    const patterns: ErrorPattern[] = [
      // Database errors
      {
        name: 'MongoDB Connection Error',
        pattern: /MongoNetworkError|ECONNREFUSED|connection.*refused/i,
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        retryable: true
      },
      {
        name: 'MongoDB Timeout',
        pattern: /MongoTimeoutError|operation.*timed.*out/i,
        category: ErrorCategory.DATABASE,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true
      },
      {
        name: 'Validation Error',
        pattern: /ValidationError|validation.*failed/i,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        recoverable: false,
        retryable: false
      },

      // Network errors
      {
        name: 'Network Timeout',
        pattern: /ETIMEDOUT|timeout|ENOTFOUND/i,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true
      },
      {
        name: 'Connection Refused',
        pattern: /ECONNREFUSED|connection.*refused/i,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        retryable: true
      },

      // Authentication/Authorization errors
      {
        name: 'JWT Expired',
        pattern: /TokenExpiredError|jwt.*expired/i,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.LOW,
        recoverable: true,
        retryable: false
      },
      {
        name: 'Authentication Failed',
        pattern: /UnauthorizedError|authentication.*failed|invalid.*credentials/i,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.MEDIUM,
        recoverable: false,
        retryable: false
      },

      // External service errors
      {
        name: 'Rate Limited',
        pattern: /rate.*limit|429|too.*many.*requests/i,
        category: ErrorCategory.EXTERNAL_SERVICE,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true
      },
      {
        name: 'Service Unavailable',
        pattern: /503|service.*unavailable|temporarily.*unavailable/i,
        category: ErrorCategory.EXTERNAL_SERVICE,
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        retryable: true
      }
    ];

    this.errorPatterns.push(...patterns);
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    const strategies: RecoveryStrategy[] = [
      {
        name: 'Database Connection Recovery',
        applicable: (error, analysis) =>
          analysis.category === ErrorCategory.DATABASE
          && error.message.includes('connection'),
        execute: async (error, context) => {
          // Implement database connection recovery logic
          this.logger.log('Attempting database connection recovery');
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          return null; // Signal to retry operation
        }
      },

      {
        name: 'Network Retry with Backoff',
        applicable: (error, analysis) => analysis.category === ErrorCategory.NETWORK && analysis.retryable,
        execute: async (error, context) => {
          const attempt = context?.attempt || 0;
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return null; // Signal to retry operation
        }
      },

      {
        name: 'Cache Fallback',
        applicable: (error, analysis) => analysis.category === ErrorCategory.EXTERNAL_SERVICE,
        execute: async (error, context) => {
          // Try to get cached data
          if (context?.cacheKey) {
            this.logger.log(`Using cache fallback for key: ${context.cacheKey}`);
            // Implementation would use actual cache service
            return context.fallbackData || null;
          }
          throw error;
        }
      }
    ];

    this.recoveryStrategies.push(...strategies);
  }

  private getSuggestedAction(pattern: ErrorPattern): string {
    switch (pattern.category) {
      case ErrorCategory.DATABASE:
        return 'Check database connection and retry';
      case ErrorCategory.NETWORK:
        return 'Check network connectivity and retry with backoff';
      case ErrorCategory.VALIDATION:
        return 'Fix input data validation errors';
      case ErrorCategory.AUTHENTICATION:
        return 'Refresh authentication tokens';
      case ErrorCategory.EXTERNAL_SERVICE:
        return 'Check external service status and use fallback data';
      default:
        return 'Log error and investigate';
    }
  }

  private isNetworkError(error: Error): boolean {
    const networkErrorPatterns = [
      /ETIMEDOUT/,
      /ECONNREFUSED/,
      /ENOTFOUND/,
      /ECONNRESET/,
      /timeout/i,
      /network/i
    ];

    return networkErrorPatterns.some(pattern => pattern.test(error.message) || pattern.test(error.name));
  }
}
