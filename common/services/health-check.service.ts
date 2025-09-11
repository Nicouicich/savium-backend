import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  responseTime: number;
  details?: Record<string, any>;
  error?: string;
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  responseTime: number;
  lastChecked: Date;
  details: Record<string, any>;
  error?: string;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  components: ComponentHealth[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
}

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private readonly healthChecks = new Map<string, () => Promise<HealthCheckResult>>();
  private readonly lastResults = new Map<string, HealthCheckResult>();

  constructor(
    private configService: ConfigService,
    @InjectConnection() private connection: Connection,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {
    this.initializeHealthChecks();
    this.startHealthMonitoring();
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(name: string, checkFunction: () => Promise<HealthCheckResult>): void {
    this.healthChecks.set(name, checkFunction);
    this.logger.debug(`Health check registered: ${name}`);
  }

  /**
   * Perform a comprehensive system health check
   */
  async performSystemHealthCheck(): Promise<SystemHealth> {
    const startTime = Date.now();
    const components: ComponentHealth[] = [];

    // Execute all health checks in parallel
    const checkPromises = Array.from(this.healthChecks.entries()).map(async ([name, checkFn]) => {
      try {
        const result = await Promise.race([
          checkFn(),
          new Promise<HealthCheckResult>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 10000)
          )
        ]);

        this.lastResults.set(name, result);
        
        return {
          name,
          status: result.status,
          responseTime: result.responseTime,
          lastChecked: result.timestamp,
          details: result.details || {},
          error: result.error
        };
      } catch (error) {
        const errorResult = {
          name,
          status: HealthStatus.UNHEALTHY,
          responseTime: Date.now() - startTime,
          lastChecked: new Date(),
          details: {},
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        this.lastResults.set(name, {
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date(),
          responseTime: errorResult.responseTime,
          error: errorResult.error
        });

        return errorResult;
      }
    });

    components.push(...await Promise.all(checkPromises));

    // Calculate overall system health
    const summary = {
      healthy: components.filter(c => c.status === HealthStatus.HEALTHY).length,
      degraded: components.filter(c => c.status === HealthStatus.DEGRADED).length,
      unhealthy: components.filter(c => c.status === HealthStatus.UNHEALTHY).length,
      unknown: components.filter(c => c.status === HealthStatus.UNKNOWN).length
    };

    const overallStatus = this.calculateOverallStatus(summary);

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: this.configService.get('app.nodeEnv') || 'development',
      components,
      summary
    };
  }

  /**
   * Get health status for a specific component
   */
  async getComponentHealth(componentName: string): Promise<ComponentHealth | null> {
    const checkFn = this.healthChecks.get(componentName);
    if (!checkFn) {
      return null;
    }

    try {
      const result = await checkFn();
      return {
        name: componentName,
        status: result.status,
        responseTime: result.responseTime,
        lastChecked: result.timestamp,
        details: result.details || {},
        error: result.error
      };
    } catch (error) {
      return {
        name: componentName,
        status: HealthStatus.UNHEALTHY,
        responseTime: 0,
        lastChecked: new Date(),
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get quick health status (cached results)
   */
  getQuickHealthStatus(): {
    status: HealthStatus;
    lastUpdated: Date;
    components: Array<{ name: string; status: HealthStatus }>;
  } {
    const components = Array.from(this.lastResults.entries()).map(([name, result]) => ({
      name,
      status: result.status
    }));

    const overallStatus = this.calculateOverallStatusFromComponents(components.map(c => c.status));
    const lastUpdated = Math.max(...Array.from(this.lastResults.values()).map(r => r.timestamp.getTime()));

    return {
      status: overallStatus,
      lastUpdated: new Date(lastUpdated),
      components
    };
  }

  /**
   * Check if system is ready to serve requests
   */
  async isReady(): Promise<boolean> {
    try {
      // Check critical components only
      const criticalChecks = ['database', 'cache'];
      
      for (const checkName of criticalChecks) {
        const checkFn = this.healthChecks.get(checkName);
        if (checkFn) {
          const result = await Promise.race([
            checkFn(),
            new Promise<HealthCheckResult>((_, reject) => 
              setTimeout(() => reject(new Error('Readiness check timeout')), 5000)
            )
          ]);

          if (result.status === HealthStatus.UNHEALTHY) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Readiness check failed:', error);
      return false;
    }
  }

  /**
   * Check if system is alive (basic liveness check)
   */
  async isAlive(): Promise<boolean> {
    try {
      // Basic checks - memory, process health
      const memUsage = process.memoryUsage();
      const heapUsedRatio = memUsage.heapUsed / memUsage.heapTotal;
      
      // If heap usage is above 95%, consider unhealthy
      if (heapUsedRatio > 0.95) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Initialize built-in health checks
   */
  private initializeHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      const startTime = Date.now();
      
      try {
        // Test database connection
        const isConnected = this.connection.readyState === 1; // 1 = connected
        
        if (!isConnected) {
          return {
            status: HealthStatus.UNHEALTHY,
            timestamp: new Date(),
            responseTime: Date.now() - startTime,
            error: 'Database not connected'
          };
        }

        // Test with a simple query
        await this.connection.db?.admin().ping();
        
        // Get connection stats
        const serverStatus = await this.connection.db?.admin().serverStatus();
        
        return {
          status: HealthStatus.HEALTHY,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          details: {
            connectionState: this.connection.readyState,
            connections: serverStatus?.connections || {},
            uptime: serverStatus?.uptime || 0,
            version: serverStatus?.version || 'unknown'
          }
        };
      } catch (error) {
        return {
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Database health check failed'
        };
      }
    });

    // Cache health check
    this.registerHealthCheck('cache', async () => {
      const startTime = Date.now();
      
      try {
        const testKey = 'health_check_' + Date.now();
        const testValue = 'test';
        
        // Test set operation
        await this.cacheManager.set(testKey, testValue, 10);
        
        // Test get operation
        const retrieved = await this.cacheManager.get(testKey);
        
        // Test delete operation
        await this.cacheManager.del(testKey);
        
        if (retrieved !== testValue) {
          return {
            status: HealthStatus.DEGRADED,
            timestamp: new Date(),
            responseTime: Date.now() - startTime,
            error: 'Cache read/write mismatch'
          };
        }

        return {
          status: HealthStatus.HEALTHY,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          details: {
            operations: ['set', 'get', 'delete'],
            testKey,
            success: true
          }
        };
      } catch (error) {
        return {
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Cache health check failed'
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const startTime = Date.now();
      
      try {
        const memUsage = process.memoryUsage();
        const heapUsedRatio = memUsage.heapUsed / memUsage.heapTotal;
        const rssInMB = Math.round(memUsage.rss / 1024 / 1024);
        
        let status = HealthStatus.HEALTHY;
        
        if (heapUsedRatio > 0.9) {
          status = HealthStatus.UNHEALTHY;
        } else if (heapUsedRatio > 0.75) {
          status = HealthStatus.DEGRADED;
        }

        return {
          status,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          details: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsedRatio: Math.round(heapUsedRatio * 100),
            rss: rssInMB,
            external: Math.round(memUsage.external / 1024 / 1024)
          }
        };
      } catch (error) {
        return {
          status: HealthStatus.UNKNOWN,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: 'Memory check failed'
        };
      }
    });

    // CPU health check
    this.registerHealthCheck('cpu', async () => {
      const startTime = Date.now();
      
      try {
        const cpuUsage = process.cpuUsage();
        const uptime = process.uptime();
        
        // Calculate CPU usage percentage (this is a simplified calculation)
        const cpuPercent = (cpuUsage.user + cpuUsage.system) / (uptime * 1000000) * 100;
        
        let status = HealthStatus.HEALTHY;
        
        if (cpuPercent > 90) {
          status = HealthStatus.UNHEALTHY;
        } else if (cpuPercent > 75) {
          status = HealthStatus.DEGRADED;
        }

        return {
          status,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          details: {
            cpuPercent: Math.round(cpuPercent),
            userTime: cpuUsage.user,
            systemTime: cpuUsage.system,
            uptime: Math.round(uptime)
          }
        };
      } catch (error) {
        return {
          status: HealthStatus.UNKNOWN,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: 'CPU check failed'
        };
      }
    });

    // Disk space health check (basic)
    this.registerHealthCheck('disk', async () => {
      const startTime = Date.now();
      
      try {
        // This is a basic implementation - in production you might want to use a library
        // to get actual disk usage statistics
        return {
          status: HealthStatus.HEALTHY,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          details: {
            note: 'Disk space monitoring not implemented - always reports healthy'
          }
        };
      } catch (error) {
        return {
          status: HealthStatus.UNKNOWN,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: 'Disk check failed'
        };
      }
    });
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    // Perform health checks every minute
    setInterval(async () => {
      try {
        const health = await this.performSystemHealthCheck();
        
        if (health.status !== HealthStatus.HEALTHY) {
          const unhealthyComponents = health.components
            .filter(c => c.status === HealthStatus.UNHEALTHY)
            .map(c => c.name);
          const degradedComponents = health.components
            .filter(c => c.status === HealthStatus.DEGRADED)
            .map(c => c.name);

          let message = `System health check: ${health.status}`;
          if (unhealthyComponents.length > 0) {
            message += ` | Unhealthy: ${unhealthyComponents.join(', ')}`;
          }
          if (degradedComponents.length > 0) {
            message += ` | Degraded: ${degradedComponents.join(', ')}`;
          }

          this.logger.warn(message);
        }
      } catch (error) {
        this.logger.error('Health monitoring error:', error);
      }
    }, 60000); // Every minute

    this.logger.log('Health monitoring started');
  }

  /**
   * Calculate overall system health status
   */
  private calculateOverallStatus(summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  }): HealthStatus {
    const total = summary.healthy + summary.degraded + summary.unhealthy + summary.unknown;
    
    if (total === 0) {
      return HealthStatus.UNKNOWN;
    }

    // If any critical component is unhealthy, system is unhealthy
    if (summary.unhealthy > 0) {
      return HealthStatus.UNHEALTHY;
    }

    // If more than 50% are degraded, system is unhealthy
    if (summary.degraded > total * 0.5) {
      return HealthStatus.UNHEALTHY;
    }

    // If any component is degraded, system is degraded
    if (summary.degraded > 0) {
      return HealthStatus.DEGRADED;
    }

    // If all are healthy, system is healthy
    if (summary.healthy === total) {
      return HealthStatus.HEALTHY;
    }

    return HealthStatus.DEGRADED;
  }

  /**
   * Calculate overall status from component statuses
   */
  private calculateOverallStatusFromComponents(statuses: HealthStatus[]): HealthStatus {
    if (statuses.length === 0) {
      return HealthStatus.UNKNOWN;
    }

    const summary = {
      healthy: statuses.filter(s => s === HealthStatus.HEALTHY).length,
      degraded: statuses.filter(s => s === HealthStatus.DEGRADED).length,
      unhealthy: statuses.filter(s => s === HealthStatus.UNHEALTHY).length,
      unknown: statuses.filter(s => s === HealthStatus.UNKNOWN).length
    };

    return this.calculateOverallStatus(summary);
  }
}