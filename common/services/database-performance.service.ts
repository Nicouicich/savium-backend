import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { DATABASE_INDEXES, CRITICAL_INDEXES, IndexDefinition } from '../../src/database/indexes';

export interface QueryPerformanceMetrics {
  averageExecutionTime: number;
  totalQueries: number;
  slowQueries: number;
  indexUsage: Record<string, number>;
  recommendations: string[];
}

export interface IndexStatus {
  name: string;
  collection: string;
  exists: boolean;
  usage: {
    ops: number;
    since: Date;
  };
  size: number;
}

@Injectable()
export class DatabasePerformanceService implements OnModuleInit {
  private readonly logger = new Logger(DatabasePerformanceService.name);

  constructor(
    @InjectConnection() private connection: Connection
  ) {}

  async onModuleInit() {
    try {
      // Create critical indexes on startup
      await this.createCriticalIndexes();
      
      // Schedule performance monitoring
      this.schedulePerformanceMonitoring();
    } catch (error) {
      this.logger.error('Error initializing database performance service', error);
    }
  }

  /**
   * Create all database indexes for optimal performance
   */
  async createAllIndexes(): Promise<void> {
    this.logger.log('Creating database indexes...');
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const indexDef of DATABASE_INDEXES) {
      try {
        const collection = this.connection.collection(indexDef.collection);
        
        // Check if index already exists
        const existingIndexes = await collection.listIndexes().toArray();
        const indexName = indexDef.options?.name || this.generateIndexName(indexDef.index);
        
        const exists = existingIndexes.some(idx => idx.name === indexName);
        
        if (!exists) {
          await collection.createIndex(indexDef.index, indexDef.options);
          createdCount++;
          this.logger.debug(`Created index ${indexName} on ${indexDef.collection}`);
        } else {
          skippedCount++;
        }
      } catch (error) {
        this.logger.error(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
    
    this.logger.log(`Index creation complete: ${createdCount} created, ${skippedCount} skipped`);
  }

  /**
   * Create only critical indexes for immediate performance improvement
   */
  async createCriticalIndexes(): Promise<void> {
    this.logger.log('Creating critical database indexes...');
    
    for (const indexDef of CRITICAL_INDEXES) {
      try {
        const collection = this.connection.collection(indexDef.collection);
        
        // Check if index already exists
        const existingIndexes = await collection.listIndexes().toArray();
        const indexName = indexDef.options?.name || this.generateIndexName(indexDef.index);
        
        // Check by name or by key pattern to avoid conflicts
        const exists = existingIndexes.some(idx => 
          idx.name === indexName || 
          JSON.stringify(idx.key) === JSON.stringify(indexDef.index)
        );
        
        if (!exists) {
          await collection.createIndex(indexDef.index, indexDef.options);
          this.logger.log(`Created critical index ${indexName} on ${indexDef.collection}`);
        } else {
          this.logger.log(`Index already exists for ${indexDef.collection}: ${indexName}`);
        }
      } catch (error) {
        this.logger.error(`Failed to create critical index on ${indexDef.collection}:`, error);
      }
    }
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsageStats(): Promise<IndexStatus[]> {
    try {
      const collections = ['users', 'accounts', 'expenses', 'categories', 'budgets', 'goals'];
      const allStats: IndexStatus[] = [];

      for (const collectionName of collections) {
        try {
          const collection = this.connection.collection(collectionName);
          
          // Get index statistics
          const indexStats = await collection.aggregate([
            { $indexStats: {} }
          ]).toArray();

          for (const stat of indexStats) {
            allStats.push({
              name: stat.name,
              collection: collectionName,
              exists: true,
              usage: {
                ops: stat.accesses?.ops || 0,
                since: stat.accesses?.since || new Date()
              },
              size: stat.size || 0
            });
          }
        } catch (error) {
          this.logger.warn(`Could not get index stats for ${collectionName}:`, error.message);
        }
      }

      return allStats;
    } catch (error) {
      this.logger.error('Error getting index usage stats:', error);
      return [];
    }
  }

  /**
   * Analyze query performance and provide recommendations
   */
  async analyzeQueryPerformance(): Promise<QueryPerformanceMetrics> {
    try {
      // Enable profiling for slow queries (>100ms)
      await this.connection.db?.command({
        profile: 2,
        slowms: 100,
        sampleRate: 0.1 // Sample 10% of operations
      });

      // Get profiling data
      const profileCollection = this.connection.collection('system.profile');
      const slowQueries = await profileCollection.find({
        ts: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).sort({ ts: -1 }).limit(100).toArray();

      const totalQueries = slowQueries.length;
      const averageExecutionTime = slowQueries.reduce((sum, query) => sum + (query.millis || 0), 0) / totalQueries;
      const slowQueriesCount = slowQueries.filter(q => (q.millis || 0) > 1000).length; // >1 second

      // Analyze index usage
      const indexUsage: Record<string, number> = {};
      slowQueries.forEach(query => {
        if (query.executionStats && query.executionStats.executionStages) {
          const stage = query.executionStats.executionStages;
          if (stage.indexName) {
            indexUsage[stage.indexName] = (indexUsage[stage.indexName] || 0) + 1;
          }
        }
      });

      // Generate recommendations
      const recommendations = this.generatePerformanceRecommendations(slowQueries);

      return {
        averageExecutionTime,
        totalQueries,
        slowQueries: slowQueriesCount,
        indexUsage,
        recommendations
      };
    } catch (error) {
      this.logger.error('Error analyzing query performance:', error);
      return {
        averageExecutionTime: 0,
        totalQueries: 0,
        slowQueries: 0,
        indexUsage: {},
        recommendations: ['Unable to analyze performance due to error']
      };
    }
  }

  /**
   * Optimize aggregation pipelines
   */
  async optimizeAggregationPipelines(): Promise<string[]> {
    const optimizations: string[] = [];

    // Common optimization patterns
    const optimizationPatterns = [
      {
        name: 'Add $match early in pipeline',
        description: 'Move $match stages as early as possible to reduce documents processed'
      },
      {
        name: 'Use $project to limit fields',
        description: 'Project only necessary fields to reduce memory usage'
      },
      {
        name: 'Optimize $lookup operations',
        description: 'Ensure foreign fields are indexed and use $match after $lookup'
      },
      {
        name: 'Use $limit with $sort',
        description: 'Add $limit after $sort to prevent sorting all documents'
      }
    ];

    optimizations.push(...optimizationPatterns.map(p => p.description));
    return optimizations;
  }

  /**
   * Monitor database connection health
   */
  async getConnectionHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    connections: {
      current: number;
      available: number;
      totalCreated: number;
    };
    operations: {
      insert: number;
      query: number;
      update: number;
      delete: number;
    };
    memory: {
      resident: number;
      virtual: number;
      mapped: number;
    };
  }> {
    try {
      const serverStatus = await this.connection.db?.admin().serverStatus();
      
      if (!serverStatus) {
        throw new Error('Could not retrieve server status');
      }
      
      return {
        status: this.determineHealthStatus(serverStatus),
        connections: {
          current: serverStatus.connections?.current || 0,
          available: serverStatus.connections?.available || 0,
          totalCreated: serverStatus.connections?.totalCreated || 0
        },
        operations: {
          insert: serverStatus.opcounters?.insert || 0,
          query: serverStatus.opcounters?.query || 0,
          update: serverStatus.opcounters?.update || 0,
          delete: serverStatus.opcounters?.delete || 0
        },
        memory: {
          resident: serverStatus.mem?.resident || 0,
          virtual: serverStatus.mem?.virtual || 0,
          mapped: serverStatus.mem?.mapped || 0
        }
      };
    } catch (error) {
      this.logger.error('Error getting connection health:', error);
      return {
        status: 'critical',
        connections: { current: 0, available: 0, totalCreated: 0 },
        operations: { insert: 0, query: 0, update: 0, delete: 0 },
        memory: { resident: 0, virtual: 0, mapped: 0 }
      };
    }
  }

  /**
   * Clean up unused indexes
   */
  async cleanupUnusedIndexes(): Promise<string[]> {
    const cleanedIndexes: string[] = [];
    
    try {
      const indexStats = await this.getIndexUsageStats();
      
      // Find indexes with zero usage (excluding _id_ index)
      const unusedIndexes = indexStats.filter(stat => 
        stat.usage.ops === 0 && 
        stat.name !== '_id_' &&
        new Date().getTime() - stat.usage.since.getTime() > 7 * 24 * 60 * 60 * 1000 // Older than 7 days
      );

      for (const unusedIndex of unusedIndexes) {
        try {
          const collection = this.connection.collection(unusedIndex.collection);
          await collection.dropIndex(unusedIndex.name);
          cleanedIndexes.push(`${unusedIndex.collection}.${unusedIndex.name}`);
          this.logger.log(`Dropped unused index: ${unusedIndex.collection}.${unusedIndex.name}`);
        } catch (error) {
          this.logger.warn(`Failed to drop index ${unusedIndex.name}:`, error.message);
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up unused indexes:', error);
    }

    return cleanedIndexes;
  }

  /**
   * Schedule periodic performance monitoring
   */
  private schedulePerformanceMonitoring(): void {
    // Run performance analysis every hour
    setInterval(async () => {
      try {
        const metrics = await this.analyzeQueryPerformance();
        
        if (metrics.slowQueries > 10) {
          this.logger.warn('High number of slow queries detected', {
            slowQueries: metrics.slowQueries,
            averageExecutionTime: metrics.averageExecutionTime
          });
        }

        // Log performance summary
        this.logger.debug('Performance metrics', {
          averageExecutionTime: metrics.averageExecutionTime,
          totalQueries: metrics.totalQueries,
          slowQueries: metrics.slowQueries
        });
      } catch (error) {
        this.logger.error('Error in scheduled performance monitoring:', error);
      }
    }, 60 * 60 * 1000); // Every hour

    // Run index cleanup weekly
    setInterval(async () => {
      try {
        const cleaned = await this.cleanupUnusedIndexes();
        if (cleaned.length > 0) {
          this.logger.log(`Weekly cleanup: removed ${cleaned.length} unused indexes`);
        }
      } catch (error) {
        this.logger.error('Error in weekly index cleanup:', error);
      }
    }, 7 * 24 * 60 * 60 * 1000); // Every week
  }

  /**
   * Generate index name from index specification
   */
  private generateIndexName(indexSpec: Record<string, any>): string {
    return Object.entries(indexSpec)
      .map(([key, value]) => `${key}_${value}`)
      .join('_');
  }

  /**
   * Generate performance recommendations based on slow queries
   */
  private generatePerformanceRecommendations(slowQueries: any[]): string[] {
    const recommendations: string[] = [];
    
    // Analyze query patterns
    const collectionScans = slowQueries.filter(q => 
      q.executionStats?.executionStages?.stage === 'COLLSCAN'
    ).length;

    if (collectionScans > 5) {
      recommendations.push('Consider adding indexes to eliminate collection scans');
    }

    const sortWithoutIndex = slowQueries.filter(q =>
      q.executionStats?.executionStages?.stage === 'SORT' &&
      !q.executionStats?.executionStages?.inputStage?.indexName
    ).length;

    if (sortWithoutIndex > 3) {
      recommendations.push('Add indexes to support sorting operations');
    }

    const highExamined = slowQueries.filter(q =>
      q.executionStats?.totalDocsExamined > q.executionStats?.totalDocsReturned * 10
    ).length;

    if (highExamined > 2) {
      recommendations.push('Optimize queries that examine many more documents than returned');
    }

    // Add general recommendations if no specific issues found
    if (recommendations.length === 0 && slowQueries.length > 0) {
      recommendations.push('Monitor query patterns and consider compound indexes for frequent queries');
    }

    return recommendations;
  }

  /**
   * Determine overall health status
   */
  private determineHealthStatus(serverStatus: any): 'healthy' | 'warning' | 'critical' {
    const connections = serverStatus.connections;
    const connectionRatio = connections.current / connections.available;

    if (connectionRatio > 0.9) return 'critical';
    if (connectionRatio > 0.7) return 'warning';
    
    return 'healthy';
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<Record<string, any>> {
    const collections = ['users', 'accounts', 'expenses', 'categories', 'budgets', 'goals'];
    const stats: Record<string, any> = {};

    for (const collectionName of collections) {
      try {
        const collection = this.connection.collection(collectionName);
        const collStats = await this.connection.db?.command({
          collStats: collectionName
        });
        
        if (collStats) {
          stats[collectionName] = {
            count: collStats.count || 0,
            size: collStats.size || 0,
            storageSize: collStats.storageSize || 0,
            indexSize: collStats.totalIndexSize || 0,
            avgObjSize: collStats.avgObjSize || 0
          };
        } else {
          stats[collectionName] = { 
            error: 'Could not retrieve collection stats'
          };
        }
      } catch (error) {
        this.logger.warn(`Could not get stats for ${collectionName}:`, error.message);
        stats[collectionName] = { error: error.message };
      }
    }

    return stats;
  }
}