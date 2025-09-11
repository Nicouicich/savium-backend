import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { performance } from 'perf_hooks';
import * as process from 'process';
import * as os from 'os';

export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: Date;
}

export interface PerformanceMetrics {
  // Request metrics
  requestCount: number;
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  
  // System metrics
  memory: {
    used: number;
    free: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  
  // Database metrics
  database: {
    connections: number;
    queryTime: number;
    slowQueries: number;
  };
  
  // Cache metrics
  cache: {
    hitRate: number;
    memory: number;
    operations: number;
  };
}

export interface AlertRule {
  name: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly metrics = new Map<string, MetricData[]>();
  private readonly responseTimes: number[] = [];
  private readonly maxMetricsStorage = 1000;
  private readonly alertRules: AlertRule[] = [];
  private readonly activeAlerts = new Map<string, Date>();

  constructor(private configService: ConfigService) {
    // Initialize default alert rules
    this.initializeDefaultAlerts();
    
    // Start metrics collection
    this.startMetricsCollection();
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, unit?: string, tags?: Record<string, string>): void {
    const metric: MetricData = {
      name,
      value,
      unit,
      tags,
      timestamp: new Date()
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Keep only recent metrics
    if (metricArray.length > this.maxMetricsStorage) {
      metricArray.shift();
    }

    // Check for alerts
    this.checkAlerts(metric);
  }

  /**
   * Record response time
   */
  recordResponseTime(timeMs: number, endpoint?: string, statusCode?: number): void {
    this.responseTimes.push(timeMs);
    
    // Keep only recent response times
    if (this.responseTimes.length > this.maxMetricsStorage) {
      this.responseTimes.shift();
    }

    // Record as metric
    this.recordMetric('response_time', timeMs, 'ms', {
      endpoint: endpoint || 'unknown',
      status_code: statusCode?.toString() || 'unknown'
    });

    // Record status code metrics
    if (statusCode) {
      this.recordMetric('http_requests_total', 1, 'count', {
        endpoint: endpoint || 'unknown',
        status_code: statusCode.toString(),
        method: 'unknown' // Could be passed as parameter
      });
    }
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(operation: string, duration: number, collection?: string): void {
    this.recordMetric('database_query_duration', duration, 'ms', {
      operation,
      collection: collection || 'unknown'
    });

    this.recordMetric('database_queries_total', 1, 'count', {
      operation,
      collection: collection || 'unknown'
    });
  }

  /**
   * Record cache metrics
   */
  recordCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key?: string): void {
    this.recordMetric('cache_operations_total', 1, 'count', {
      operation,
      cache_key: key ? this.hashKey(key) : 'unknown' // Hash for privacy
    });
  }

  /**
   * Record error metrics
   */
  recordError(error: Error, context?: string, userId?: string): void {
    this.recordMetric('errors_total', 1, 'count', {
      error_type: error.constructor.name,
      context: context || 'unknown',
      has_user: userId ? 'true' : 'false'
    });

    // Log error with context
    this.logger.error(`Error recorded: ${error.message}`, {
      context,
      userId: userId ? this.hashKey(userId) : undefined, // Hash for privacy
      stack: error.stack
    });
  }

  /**
   * Record business metrics
   */
  recordBusinessMetric(metric: string, value: number, accountId?: string): void {
    this.recordMetric(`business.${metric}`, value, 'count', {
      account_id: accountId ? this.hashKey(accountId) : 'unknown'
    });
  }

  /**
   * Get comprehensive performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Calculate response time metrics
    const recentResponseTimes = this.responseTimes.slice(-100); // Last 100 requests
    const responseTimeMetrics = this.calculatePercentiles(recentResponseTimes);

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Get CPU metrics
    const cpuUsage = process.cpuUsage();
    const loadAverage = os.loadavg();

    // Get error rate
    const totalRequests = this.getMetricCount('http_requests_total', oneHourAgo);
    const errorRequests = this.getMetricCount('errors_total', oneHourAgo);
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    return {
      requestCount: totalRequests,
      responseTime: responseTimeMetrics,
      errorRate,
      
      memory: {
        used: usedMemory,
        free: freeMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to ms
        loadAverage
      },
      
      database: {
        connections: 0, // Would be populated from database service
        queryTime: this.getAverageMetricValue('database_query_duration', oneHourAgo),
        slowQueries: this.getMetricCount('database_slow_queries', oneHourAgo)
      },
      
      cache: {
        hitRate: this.calculateCacheHitRate(oneHourAgo),
        memory: 0, // Would be populated from cache service
        operations: this.getMetricCount('cache_operations_total', oneHourAgo)
      }
    };
  }

  /**
   * Get metrics for a specific time range
   */
  getMetricsInRange(metricName: string, startTime: Date, endTime: Date): MetricData[] {
    const metrics = this.metrics.get(metricName) || [];
    return metrics.filter(metric => 
      metric.timestamp >= startTime && metric.timestamp <= endTime
    );
  }

  /**
   * Get top endpoints by request count
   */
  getTopEndpoints(limit = 10): Array<{ endpoint: string; count: number; avgResponseTime: number }> {
    const endpointStats = new Map<string, { count: number; totalTime: number }>();
    
    const httpMetrics = this.metrics.get('http_requests_total') || [];
    const responseTimeMetrics = this.metrics.get('response_time') || [];
    
    // Count requests per endpoint
    httpMetrics.forEach(metric => {
      const endpoint = metric.tags?.endpoint || 'unknown';
      const existing = endpointStats.get(endpoint) || { count: 0, totalTime: 0 };
      existing.count++;
      endpointStats.set(endpoint, existing);
    });

    // Add response times
    responseTimeMetrics.forEach(metric => {
      const endpoint = metric.tags?.endpoint || 'unknown';
      const existing = endpointStats.get(endpoint);
      if (existing) {
        existing.totalTime += metric.value;
      }
    });

    // Convert to array and sort
    return Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgResponseTime: stats.count > 0 ? stats.totalTime / stats.count : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    this.logger.log(`Alert rule added: ${rule.name}`);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Array<{ name: string; triggeredAt: Date; severity: string }> {
    return Array.from(this.activeAlerts.entries()).map(([name, triggeredAt]) => {
      const rule = this.alertRules.find(r => r.name === name);
      return {
        name,
        triggeredAt,
        severity: rule?.severity || 'unknown'
      };
    });
  }

  /**
   * Generate health check report
   */
  async getHealthReport(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, { status: boolean; message?: string; responseTime?: number }>;
    uptime: number;
    version: string;
  }> {
    const checks: Record<string, { status: boolean; message?: string; responseTime?: number }> = {};
    
    // Memory check
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.memory = {
      status: heapUsedPercent < 90,
      message: heapUsedPercent >= 90 ? 'High memory usage' : 'Memory usage normal',
      responseTime: 0
    };

    // Response time check
    const avgResponseTime = this.getAverageMetricValue('response_time', Date.now() - 5 * 60 * 1000);
    checks.response_time = {
      status: avgResponseTime < 1000,
      message: avgResponseTime >= 1000 ? 'High response times' : 'Response times normal',
      responseTime: avgResponseTime
    };

    // Error rate check
    const errorRate = await this.getErrorRate();
    checks.error_rate = {
      status: errorRate < 5,
      message: errorRate >= 5 ? 'High error rate' : 'Error rate normal'
    };

    // Determine overall status
    const failedChecks = Object.values(checks).filter(check => !check.status).length;
    const status = failedChecks === 0 ? 'healthy' : 
                  failedChecks <= 1 ? 'degraded' : 'unhealthy';

    return {
      status,
      checks,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    let output = '';
    
    this.metrics.forEach((metricData, metricName) => {
      if (metricData.length === 0) return;
      
      const latestMetric = metricData[metricData.length - 1];
      const sanitizedName = metricName.replace(/[^a-zA-Z0-9_]/g, '_');
      
      // Add metric help and type
      output += `# HELP ${sanitizedName} ${metricName} metric\n`;
      output += `# TYPE ${sanitizedName} gauge\n`;
      
      // Add metric value
      const labels = latestMetric.tags ? 
        Object.entries(latestMetric.tags)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',') : '';
      
      const labelString = labels ? `{${labels}}` : '';
      output += `${sanitizedName}${labelString} ${latestMetric.value}\n\n`;
    });
    
    return output;
  }

  /**
   * Private helper methods
   */
  private initializeDefaultAlerts(): void {
    const defaultAlerts: AlertRule[] = [
      {
        name: 'high_response_time',
        metric: 'response_time',
        condition: 'greater_than',
        threshold: 2000, // 2 seconds
        duration: 300, // 5 minutes
        severity: 'high',
        enabled: true
      },
      {
        name: 'high_error_rate',
        metric: 'error_rate',
        condition: 'greater_than',
        threshold: 10, // 10%
        duration: 300,
        severity: 'critical',
        enabled: true
      },
      {
        name: 'high_memory_usage',
        metric: 'memory_usage',
        condition: 'greater_than',
        threshold: 90, // 90%
        duration: 600, // 10 minutes
        severity: 'high',
        enabled: true
      }
    ];

    this.alertRules.push(...defaultAlerts);
  }

  private startMetricsCollection(): void {
    // Collect system metrics every minute
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000);

    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
  }

  private collectSystemMetrics(): void {
    try {
      // Memory metrics
      const memUsage = process.memoryUsage();
      this.recordMetric('memory_heap_used', memUsage.heapUsed, 'bytes');
      this.recordMetric('memory_heap_total', memUsage.heapTotal, 'bytes');
      
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      this.recordMetric('memory_usage', (usedMemory / totalMemory) * 100, 'percent');

      // CPU metrics
      const cpuUsage = process.cpuUsage();
      this.recordMetric('cpu_usage', (cpuUsage.user + cpuUsage.system) / 1000000, 'ms');
      
      // Load average
      const loadAvg = os.loadavg();
      this.recordMetric('load_average_1m', loadAvg[0], 'float');
      this.recordMetric('load_average_5m', loadAvg[1], 'float');
      this.recordMetric('load_average_15m', loadAvg[2], 'float');

      // Process metrics
      this.recordMetric('process_uptime', process.uptime(), 'seconds');
    } catch (error) {
      this.logger.error('Error collecting system metrics:', error);
    }
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    this.metrics.forEach((metricData, metricName) => {
      const filteredData = metricData.filter(metric => metric.timestamp > cutoffTime);
      this.metrics.set(metricName, filteredData);
    });
  }

  private checkAlerts(metric: MetricData): void {
    this.alertRules.forEach(rule => {
      if (!rule.enabled || rule.metric !== metric.name) return;

      let shouldAlert = false;
      
      switch (rule.condition) {
        case 'greater_than':
          shouldAlert = metric.value > rule.threshold;
          break;
        case 'less_than':
          shouldAlert = metric.value < rule.threshold;
          break;
        case 'equals':
          shouldAlert = metric.value === rule.threshold;
          break;
      }

      if (shouldAlert && !this.activeAlerts.has(rule.name)) {
        this.activeAlerts.set(rule.name, new Date());
        this.triggerAlert(rule, metric);
      } else if (!shouldAlert && this.activeAlerts.has(rule.name)) {
        this.activeAlerts.delete(rule.name);
        this.resolveAlert(rule);
      }
    });
  }

  private triggerAlert(rule: AlertRule, metric: MetricData): void {
    this.logger.warn(`ALERT TRIGGERED: ${rule.name}`, {
      rule: rule.name,
      severity: rule.severity,
      threshold: rule.threshold,
      actualValue: metric.value,
      metric: metric.name
    });

    // In production: send notifications, webhooks, etc.
  }

  private resolveAlert(rule: AlertRule): void {
    this.logger.log(`ALERT RESOLVED: ${rule.name}`);
    
    // In production: send resolution notifications
  }

  private calculatePercentiles(values: number[]): {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  private getMetricCount(metricName: string, since: number): number {
    const metrics = this.metrics.get(metricName) || [];
    return metrics.filter(m => m.timestamp.getTime() > since).length;
  }

  private getAverageMetricValue(metricName: string, since: number): number {
    const metrics = this.metrics.get(metricName) || [];
    const recentMetrics = metrics.filter(m => m.timestamp.getTime() > since);
    
    if (recentMetrics.length === 0) return 0;
    
    const sum = recentMetrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / recentMetrics.length;
  }

  private calculateCacheHitRate(since: number): number {
    const hits = this.getMetricCount('cache_operations_total', since); // Would filter by hit operations
    const misses = this.getMetricCount('cache_operations_total', since); // Would filter by miss operations
    
    return hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;
  }

  private async getErrorRate(): Promise<number> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const totalRequests = this.getMetricCount('http_requests_total', oneHourAgo);
    const errorRequests = this.getMetricCount('errors_total', oneHourAgo);
    
    return totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
  }

  private hashKey(key: string): string {
    // Simple hash for privacy - in production use a proper hash function
    return Buffer.from(key).toString('base64').substring(0, 8);
  }
}