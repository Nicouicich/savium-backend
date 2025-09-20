import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  details?: Record<string, any>;
  timestamp: Date;
  traceId?: string;
}

export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGIN_BRUTE_FORCE = 'LOGIN_BRUTE_FORCE',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',

  // Rate limiting events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TEMPORARY_BAN_APPLIED = 'TEMPORARY_BAN_APPLIED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',

  // Data access events
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  FINANCIAL_TRANSACTION = 'FINANCIAL_TRANSACTION',
  BULK_DATA_EXPORT = 'BULK_DATA_EXPORT',
  ADMIN_OPERATION = 'ADMIN_OPERATION',

  // Input validation events
  VALIDATION_FAILURE = 'VALIDATION_FAILURE',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',

  // System events
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  API_KEY_USAGE = 'API_KEY_USAGE'
}

export enum SecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);
  private readonly eventBuffer: SecurityEvent[] = [];
  private readonly maxBufferSize = 1000;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService
  ) {
    // Flush buffer periodically
    setInterval(() => this.flushBuffer(), 30000); // Every 30 seconds
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    };

    // Add to buffer for batch processing
    this.eventBuffer.push(fullEvent);

    // Handle critical events immediately
    if (event.severity === SecuritySeverity.CRITICAL) {
      await this.handleCriticalEvent(fullEvent);
    }

    // Log to console for immediate visibility
    const logLevel = this.getLogLevel(event.severity);
    this.logger[logLevel](`Security Event: ${event.type}`, {
      ...fullEvent,
      sensitiveData: '[REDACTED]'
    });

    // Trigger alerts if needed
    if (event.severity === SecuritySeverity.HIGH || event.severity === SecuritySeverity.CRITICAL) {
      await this.triggerAlert(fullEvent);
    }

    // Check buffer size and flush if needed
    if (this.eventBuffer.length >= this.maxBufferSize) {
      await this.flushBuffer();
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    type: SecurityEventType,
    userId?: string,
    ipAddress?: string,
    details?: Record<string, any>,
    traceId?: string
  ): Promise<void> {
    const severity = this.getAuthEventSeverity(type);

    await this.logSecurityEvent({
      type,
      severity,
      userId,
      ipAddress,
      details,
      traceId
    });

    // Track failed login attempts
    if (type === SecurityEventType.LOGIN_FAILURE && ipAddress) {
      await this.trackFailedLogin(ipAddress, userId);
    }
  }

  /**
   * Log financial transaction events
   */
  async logFinancialEvent(
    userId: string,
    accountId: string,
    operation: string,
    amount?: number,
    currency?: string,
    ipAddress?: string,
    traceId?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      type: SecurityEventType.FINANCIAL_TRANSACTION,
      severity: SecuritySeverity.MEDIUM,
      userId,
      ipAddress,
      details: {
        accountId,
        operation,
        amount,
        currency,
        timestamp: new Date().toISOString()
      },
      traceId
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    userId: string,
    resource: string,
    operation: 'READ' | 'WRITE' | 'DELETE',
    sensitive: boolean = false,
    ipAddress?: string,
    traceId?: string
  ): Promise<void> {
    await this.logSecurityEvent({
      type: sensitive ? SecurityEventType.SENSITIVE_DATA_ACCESS : SecurityEventType.ADMIN_OPERATION,
      severity: sensitive ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM,
      userId,
      ipAddress,
      details: {
        resource,
        operation,
        sensitive
      },
      traceId
    });
  }

  /**
   * Log validation failures and potential attacks
   */
  async logValidationFailure(
    type: SecurityEventType,
    endpoint: string,
    payload?: any,
    ipAddress?: string,
    traceId?: string
  ): Promise<void> {
    const severity = type === SecurityEventType.XSS_ATTEMPT || type === SecurityEventType.SQL_INJECTION_ATTEMPT
      ? SecuritySeverity.HIGH
      : SecuritySeverity.MEDIUM;

    await this.logSecurityEvent({
      type,
      severity,
      endpoint,
      ipAddress,
      details: {
        payload: payload ? JSON.stringify(payload).substring(0, 500) : undefined // Limit size
      },
      traceId
    });
  }

  /**
   * Track failed login attempts and detect brute force
   */
  private async trackFailedLogin(ipAddress: string, userId?: string): Promise<void> {
    const key = `failed_login:${ipAddress}`;
    const userKey = userId ? `failed_login_user:${userId}` : null;

    try {
      const ipFailures = (await this.cacheManager.get<number>(key)) || 0;
      const newIpFailures = ipFailures + 1;

      await this.cacheManager.set(key, newIpFailures, 3600); // 1 hour TTL

      // Check user-specific failures if user is identified
      let userFailures = 0;
      if (userKey) {
        userFailures = (await this.cacheManager.get<number>(userKey)) || 0;
        await this.cacheManager.set(userKey, userFailures + 1, 3600);
      }

      // Detect brute force attack
      if (newIpFailures >= 5 || userFailures >= 3) {
        await this.logSecurityEvent({
          type: SecurityEventType.LOGIN_BRUTE_FORCE,
          severity: SecuritySeverity.HIGH,
          userId,
          ipAddress,
          details: {
            ipFailures: newIpFailures,
            userFailures,
            threshold: 'EXCEEDED'
          }
        });
      }
    } catch (error) {
      this.logger.error('Error tracking failed login', error);
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(timeRange: 'last_hour' | 'last_day' | 'last_week' = 'last_day'): Promise<{
    totalEvents: number;
    eventsByType: Record<SecurityEventType, number>;
    eventsBySeverity: Record<SecuritySeverity, number>;
    topIpAddresses: { ip: string; count: number }[];
    topUsers: { userId: string; count: number }[];
  }> {
    // In a real implementation, this would query the persistent storage
    // For now, return mock data structure
    return {
      totalEvents: 0,
      eventsByType: {} as Record<SecurityEventType, number>,
      eventsBySeverity: {} as Record<SecuritySeverity, number>,
      topIpAddresses: [],
      topUsers: []
    };
  }

  /**
   * Handle critical security events
   */
  private async handleCriticalEvent(event: SecurityEvent): Promise<void> {
    // Immediate actions for critical events
    try {
      // Store in high-priority cache
      const criticalKey = `critical_event:${Date.now()}:${Math.random()}`;
      await this.cacheManager.set(criticalKey, event, 86400); // 24 hours

      // Log to console immediately
      this.logger.error('CRITICAL SECURITY EVENT', {
        type: event.type,
        userId: event.userId,
        ipAddress: event.ipAddress,
        timestamp: event.timestamp.toISOString()
      });

      // In production: Send immediate alerts, trigger webhooks, etc.
    } catch (error) {
      this.logger.error('Error handling critical event', error);
    }
  }

  /**
   * Trigger security alerts
   */
  private async triggerAlert(event: SecurityEvent): Promise<void> {
    try {
      // In production: integrate with alerting systems
      // - Send email alerts
      // - Trigger Slack/Teams notifications
      // - Call webhook endpoints
      // - Update monitoring dashboards

      this.logger.warn('Security alert triggered', {
        type: event.type,
        severity: event.severity,
        timestamp: event.timestamp.toISOString()
      });
    } catch (error) {
      this.logger.error('Error triggering alert', error);
    }
  }

  /**
   * Flush event buffer to persistent storage
   */
  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const eventsToFlush = this.eventBuffer.splice(0, this.eventBuffer.length);

      // In production: send to persistent storage, analytics service, etc.
      // For now, just log the count
      this.logger.debug(`Flushed ${eventsToFlush.length} security events`);

      // Could implement:
      // - Database insertion
      // - Log shipping to external services
      // - Metrics collection
      // - Real-time analytics
    } catch (error) {
      this.logger.error('Error flushing security event buffer', error);
    }
  }

  /**
   * Get appropriate log level for severity
   */
  private getLogLevel(severity: SecuritySeverity): 'debug' | 'log' | 'warn' | 'error' {
    switch (severity) {
      case SecuritySeverity.LOW:
        return 'debug';
      case SecuritySeverity.MEDIUM:
        return 'log';
      case SecuritySeverity.HIGH:
        return 'warn';
      case SecuritySeverity.CRITICAL:
        return 'error';
      default:
        return 'log';
    }
  }

  /**
   * Get severity for auth events
   */
  private getAuthEventSeverity(type: SecurityEventType): SecuritySeverity {
    switch (type) {
      case SecurityEventType.LOGIN_SUCCESS:
      case SecurityEventType.TOKEN_REFRESH:
        return SecuritySeverity.LOW;
      case SecurityEventType.LOGIN_FAILURE:
      case SecurityEventType.TOKEN_EXPIRED:
      case SecurityEventType.PASSWORD_CHANGE:
        return SecuritySeverity.MEDIUM;
      case SecurityEventType.LOGIN_BRUTE_FORCE:
      case SecurityEventType.UNAUTHORIZED_ACCESS:
        return SecuritySeverity.HIGH;
      default:
        return SecuritySeverity.MEDIUM;
    }
  }

  /**
   * Clear old security events (cleanup job)
   */
  async cleanupOldEvents(olderThanDays: number = 30): Promise<number> {
    try {
      // In production: implement cleanup logic for persistent storage
      this.logger.log(`Cleanup job: removing events older than ${olderThanDays} days`);
      return 0; // Return number of cleaned up events
    } catch (error) {
      this.logger.error('Error cleaning up old events', error);
      return 0;
    }
  }

  /**
   * Export security events for compliance
   */
  async exportEvents(
    startDate: Date,
    endDate: Date,
    eventTypes?: SecurityEventType[],
    format: 'json' | 'csv' = 'json'
  ): Promise<any> {
    try {
      // In production: implement export logic
      this.logger.log(`Exporting security events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      return {
        exportDate: new Date().toISOString(),
        dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        format,
        eventTypes: eventTypes || 'ALL',
        events: [] // Would contain actual events
      };
    } catch (error) {
      this.logger.error('Error exporting security events', error);
      throw error;
    }
  }
}
