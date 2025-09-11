import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  recoveryTimeout: number; // Time in ms before attempting recovery
  monitoringPeriod: number; // Time window for failure counting
  successThreshold: number; // Successful calls needed to close circuit from half-open
  timeout: number; // Individual request timeout
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  timeouts: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
  totalRequests: number;
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private timeouts = 0;
  private lastFailureTime?: Date;
  private nextRetryTime?: Date;
  private totalRequests = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig,
    private readonly logger: Logger
  ) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // If circuit is open, check if we should transition to half-open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.log(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        // Circuit is still open, fail fast
        this.logger.warn(`Circuit breaker ${this.name} is OPEN, failing fast`);
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      // Execute operation with timeout
      const result = await this.executeWithTimeout(operation);
      
      // Success
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure
      this.onFailure();
      
      if (fallback) {
        try {
          return await fallback();
        } catch (fallbackError) {
          this.logger.error(`Fallback failed for circuit ${this.name}:`, fallbackError);
          throw error; // Throw original error, not fallback error
        }
      }
      
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.timeouts++;
        reject(new Error(`Operation timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successes++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successes = 0;
        this.logger.log(`Circuit breaker ${this.name} is now CLOSED`);
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN || 
        this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeout);
      this.logger.warn(`Circuit breaker ${this.name} is now OPEN`);
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextRetryTime !== undefined && 
           new Date() > this.nextRetryTime;
  }

  getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      timeouts: this.timeouts,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime,
      totalRequests: this.totalRequests
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.timeouts = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
    this.logger.log(`Circuit breaker ${this.name} has been manually reset`);
  }

  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeout);
    this.logger.warn(`Circuit breaker ${this.name} has been manually opened`);
  }
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(private configService: ConfigService) {
    this.initializeDefaultCircuitBreakers();
  }

  /**
   * Get or create a circuit breaker for a service
   */
  getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        successThreshold: 3,
        timeout: 30000 // 30 seconds
      };

      const finalConfig = { ...defaultConfig, ...config };
      const circuitBreaker = new CircuitBreaker(name, finalConfig, this.logger);
      this.circuitBreakers.set(name, circuitBreaker);
    }

    return this.circuitBreakers.get(name)!;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceName, config);
    return circuitBreaker.execute(operation, fallback);
  }

  /**
   * Execute database operation with circuit breaker
   */
  async executeDatabase<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    return this.execute('database', operation, fallback, {
      failureThreshold: 10,
      timeout: 5000, // 5 seconds for database operations
      recoveryTimeout: 30000 // 30 seconds recovery
    });
  }

  /**
   * Execute external API call with circuit breaker
   */
  async executeExternalAPI<T>(
    apiName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    return this.execute(`external_api_${apiName}`, operation, fallback, {
      failureThreshold: 3,
      timeout: 10000, // 10 seconds for external APIs
      recoveryTimeout: 120000 // 2 minutes recovery
    });
  }

  /**
   * Execute AI service call with circuit breaker
   */
  async executeAIService<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    return this.execute('ai_service', operation, fallback, {
      failureThreshold: 2, // AI services can be flaky
      timeout: 30000, // 30 seconds for AI operations
      recoveryTimeout: 300000 // 5 minutes recovery
    });
  }

  /**
   * Execute email service call with circuit breaker
   */
  async executeEmailService<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    return this.execute('email_service', operation, fallback, {
      failureThreshold: 5,
      timeout: 15000, // 15 seconds
      recoveryTimeout: 60000 // 1 minute recovery
    });
  }

  /**
   * Execute WhatsApp API call with circuit breaker
   */
  async executeWhatsAppAPI<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    return this.execute('whatsapp_api', operation, fallback, {
      failureThreshold: 3,
      timeout: 10000,
      recoveryTimeout: 180000 // 3 minutes recovery
    });
  }

  /**
   * Execute Telegram API call with circuit breaker
   */
  async executeTelegramAPI<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    return this.execute('telegram_api', operation, fallback, {
      failureThreshold: 3,
      timeout: 10000,
      recoveryTimeout: 180000 // 3 minutes recovery
    });
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitStats> {
    const stats: Record<string, CircuitStats> = {};
    
    this.circuitBreakers.forEach((circuitBreaker, name) => {
      stats[name] = circuitBreaker.getStats();
    });

    return stats;
  }

  /**
   * Get statistics for a specific circuit breaker
   */
  getStats(name: string): CircuitStats | null {
    const circuitBreaker = this.circuitBreakers.get(name);
    return circuitBreaker ? circuitBreaker.getStats() : null;
  }

  /**
   * Reset a specific circuit breaker
   */
  resetCircuitBreaker(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.reset();
      return true;
    }
    return false;
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakers.forEach(circuitBreaker => {
      circuitBreaker.reset();
    });
    this.logger.log('All circuit breakers have been reset');
  }

  /**
   * Force open a circuit breaker (for maintenance)
   */
  forceOpenCircuitBreaker(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.forceOpen();
      return true;
    }
    return false;
  }

  /**
   * Get health status based on circuit breaker states
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    openCircuits: string[];
    halfOpenCircuits: string[];
    details: Record<string, CircuitStats>;
  } {
    const stats = this.getAllStats();
    const openCircuits: string[] = [];
    const halfOpenCircuits: string[] = [];

    Object.entries(stats).forEach(([name, stat]) => {
      if (stat.state === CircuitState.OPEN) {
        openCircuits.push(name);
      } else if (stat.state === CircuitState.HALF_OPEN) {
        halfOpenCircuits.push(name);
      }
    });

    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (openCircuits.length === 0) {
      status = halfOpenCircuits.length === 0 ? 'healthy' : 'degraded';
    } else {
      // Check if critical services are down
      const criticalServices = ['database', 'ai_service'];
      const criticalDown = openCircuits.some(circuit => 
        criticalServices.some(service => circuit.includes(service))
      );
      
      status = criticalDown ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      openCircuits,
      halfOpenCircuits,
      details: stats
    };
  }

  /**
   * Monitor and alert on circuit breaker states
   */
  private initializeDefaultCircuitBreakers(): void {
    // Pre-initialize common circuit breakers with sensible defaults
    const commonServices = [
      'database',
      'ai_service', 
      'email_service',
      'whatsapp_api',
      'telegram_api'
    ];

    commonServices.forEach(service => {
      this.getCircuitBreaker(service);
    });

    // Start monitoring
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Monitor circuit breaker health every minute
    setInterval(() => {
      const healthStatus = this.getHealthStatus();
      
      if (healthStatus.status !== 'healthy') {
        this.logger.warn('Circuit breaker health check', {
          status: healthStatus.status,
          openCircuits: healthStatus.openCircuits,
          halfOpenCircuits: healthStatus.halfOpenCircuits
        });
      }

      // Log statistics every 5 minutes
      if (Date.now() % (5 * 60 * 1000) < 60000) { // Approximately every 5 minutes
        const stats = this.getAllStats();
        Object.entries(stats).forEach(([name, stat]) => {
          if (stat.totalRequests > 0) {
            const errorRate = ((stat.failures + stat.timeouts) / stat.totalRequests) * 100;
            
            this.logger.debug(`Circuit breaker stats: ${name}`, {
              state: stat.state,
              totalRequests: stat.totalRequests,
              failures: stat.failures,
              timeouts: stat.timeouts,
              errorRate: Math.round(errorRate * 100) / 100
            });
          }
        });
      }
    }, 60000); // Every minute
  }

  /**
   * Create a retry wrapper with exponential backoff
   */
  async executeWithRetry<T>(
    serviceName: string,
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(serviceName, operation);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          this.logger.warn(`Attempt ${attempt + 1} failed for ${serviceName}, retrying in ${delay}ms:`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Bulk operation with circuit breaker protection
   */
  async executeBulk<T>(
    serviceName: string,
    operations: Array<() => Promise<T>>,
    concurrency = 5
  ): Promise<Array<T | Error>> {
    const results: Array<T | Error> = [];
    
    // Process in batches to control concurrency
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(operation => this.execute(serviceName, operation))
      );

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push(new Error(result.reason));
        }
      });
    }

    return results;
  }
}