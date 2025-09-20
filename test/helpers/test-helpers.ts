import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';

// Test configurations
const testDbConfig = () => ({
  database: {
    uri: '', // Will be set by MongoMemoryServer
    options: {
      maxPoolSize: 5,
      minPoolSize: 1,
      maxIdleTimeMS: 10000,
      serverSelectionTimeoutMS: 2000
    }
  },
  redis: {
    host: 'localhost',
    port: 6379,
    cache: { ttl: 300, maxItems: 1000 }
  },
  jwt: {
    accessToken: {
      secret: 'test-secret-access',
      expiresIn: '15m'
    },
    refreshToken: {
      secret: 'test-secret-refresh',
      expiresIn: '7d'
    },
    options: {
      issuer: 'savium-test',
      audience: 'savium-test-client'
    }
  }
});

export class TestSetup {
  private static mongoServer: MongoMemoryServer;
  private static app: INestApplication;
  private static connection: Connection;
  private static jwtService: JwtService;

  /**
   * Set up test environment with in-memory database
   */
  static async createTestApp(AppModule: any): Promise<INestApplication> {
    // Start in-memory MongoDB
    TestSetup.mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '6.0.0'
      }
    });

    const mongoUri = TestSetup.mongoServer.getUri();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({ ...testDbConfig(), database: { ...testDbConfig().database, uri: mongoUri } })],
          isGlobal: true
        }),
        MongooseModule.forRoot(mongoUri),
        CacheModule.register({
          store: 'memory',
          ttl: 300,
          max: 1000
        }),
        AppModule
      ]
    }).compile();

    TestSetup.app = moduleRef.createNestApplication();
    TestSetup.connection = moduleRef.get<Connection>(getConnectionToken());
    TestSetup.jwtService = moduleRef.get<JwtService>(JwtService);

    await TestSetup.app.init();
    return TestSetup.app;
  }

  /**
   * Clean up test environment
   */
  static async cleanup(): Promise<void> {
    if (TestSetup.connection) {
      await TestSetup.connection.dropDatabase();
      await TestSetup.connection.close();
    }

    if (TestSetup.app) {
      await TestSetup.app.close();
    }

    if (TestSetup.mongoServer) {
      await TestSetup.mongoServer.stop();
    }
  }

  /**
   * Get database connection for test data setup
   */
  static getConnection(): Connection {
    return TestSetup.connection;
  }

  /**
   * Get application instance
   */
  static getApp(): INestApplication {
    return TestSetup.app;
  }

  /**
   * Create authenticated JWT token for testing
   */
  static createAuthToken(payload: any): string {
    return TestSetup.jwtService.sign(payload);
  }
}

/**
 * Test data factory for creating consistent test data
 */
export class TestDataFactory {
  /**
   * Create test user data
   */
  static createUserData(overrides: Partial<any> = {}) {
    return {
      firstName: 'Test',
      lastName: 'User',
      email: `test.user.${Date.now()}@example.com`,
      password: 'TestPass123!',
      role: 'USER',
      isActive: true,
      ...overrides
    };
  }

  /**
   * Create test account data
   */
  static createAccountData(ownerId: string, overrides: Partial<any> = {}) {
    return {
      name: `Test Account ${Date.now()}`,
      type: 'PERSONAL',
      description: 'Test account for unit tests',
      currency: 'USD',
      timezone: 'UTC',
      owner: ownerId,
      members: [],
      status: 'active',
      ...overrides
    };
  }

  /**
   * Create test transaction data
   */
  static createTransactionData(accountId: string, userId: string, overrides: Partial<any> = {}) {
    return {
      amount: 100.5,
      description: 'Test transaction',
      categoryId: '507f1f77bcf86cd799439011',
      accountId,
      userId,
      date: new Date(),
      currency: 'USD',
      type: 'transaction',
      ...overrides
    };
  }

  /**
   * Create test category data
   */
  static createCategoryData(accountId: string, overrides: Partial<any> = {}) {
    return {
      name: `Test Category ${Date.now()}`,
      type: 'transaction',
      color: '#FF5733',
      icon: 'shopping',
      accountId,
      isActive: true,
      ...overrides
    };
  }

  /**
   * Create test budget data
   */
  static createBudgetData(accountId: string, createdBy: string, overrides: Partial<any> = {}) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      accountId,
      name: `Test Budget ${Date.now()}`,
      totalAmount: 1000,
      period: 'monthly',
      startDate,
      endDate,
      createdBy,
      status: 'active',
      categoryBudgets: [],
      ...overrides
    };
  }
}

/**
 * Common test utilities
 */
export class TestUtils {
  /**
   * Wait for a specified amount of time
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate random string for testing
   */
  static randomString(length = 10): string {
    return Math.random()
      .toString(36)
      .substring(2, 2 + length);
  }

  /**
   * Generate random email for testing
   */
  static randomEmail(): string {
    return `test.${this.randomString(8)}@example.com`;
  }

  /**
   * Create authenticated request helper
   */
  static authenticatedRequest(app: INestApplication, token: string) {
    return request(app.getHttpServer()).set('Authorization', `Bearer ${token}`);
  }

  /**
   * Assert response has correct structure
   */
  static assertResponseStructure(response: any, expectedFields: string[]): void {
    expectedFields.forEach(field => {
      expect(response).toHaveProperty(field);
    });
  }

  /**
   * Assert validation error response
   */
  static assertValidationError(response: any, expectedMessage?: string): void {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('errors');

    if (expectedMessage) {
      expect(response.body.message).toContain(expectedMessage);
    }
  }

  /**
   * Assert unauthorized error response
   */
  static assertUnauthorizedError(response: any): void {
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  }

  /**
   * Assert forbidden error response
   */
  static assertForbiddenError(response: any): void {
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
  }

  /**
   * Assert not found error response
   */
  static assertNotFoundError(response: any): void {
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
  }

  /**
   * Clean all collections in test database
   */
  static async cleanDatabase(connection: Connection): Promise<void> {
    const collections = connection.collections;

    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }

  /**
   * Create and save test document
   */
  static async createTestDocument<T>(connection: Connection, collectionName: string, data: any): Promise<T> {
    const collection = connection.collection(collectionName);
    const result = await collection.insertOne(data);
    return { ...data, _id: result.insertedId } as T;
  }

  /**
   * Mock external service calls
   */
  static mockExternalService(serviceName: string, methods: Record<string, any>) {
    const mockService = {};

    Object.keys(methods).forEach(method => {
      mockService[method] = jest.fn().mockImplementation(methods[method]);
    });

    return mockService;
  }

  /**
   * Create test performance metrics
   */
  static async measurePerformance<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number; memoryUsage: any }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    const result = await operation();

    const endTime = Date.now();
    const endMemory = process.memoryUsage();

    return {
      result,
      duration: endTime - startTime,
      memoryUsage: {
        heapUsedDelta: endMemory.heapUsed - startMemory.heapUsed,
        heapTotalDelta: endMemory.heapTotal - startMemory.heapTotal
      }
    };
  }

  /**
   * Assert performance metrics
   */
  static assertPerformance(metrics: { duration: number; memoryUsage: any }, maxDuration?: number, maxMemoryIncrease?: number): void {
    if (maxDuration) {
      expect(metrics.duration).toBeLessThan(maxDuration);
    }

    if (maxMemoryIncrease) {
      expect(metrics.memoryUsage.heapUsedDelta).toBeLessThan(maxMemoryIncrease);
    }
  }
}

/**
 * API Testing helpers
 */
export class ApiTestHelpers {
  /**
   * Test CRUD operations for a resource
   */
  static async testCrudOperations(app: INestApplication, endpoint: string, authToken: string, createData: any, updateData: any, requiredFields: string[]) {
    // Test CREATE
    const createResponse = await TestUtils.authenticatedRequest(app, authToken).post(endpoint).send(createData).expect(201);

    const createdId = createResponse.body.id;
    TestUtils.assertResponseStructure(createResponse.body, requiredFields);

    // Test READ (single)
    const readResponse = await TestUtils.authenticatedRequest(app, authToken).get(`${endpoint}/${createdId}`).expect(200);

    TestUtils.assertResponseStructure(readResponse.body, requiredFields);

    // Test UPDATE
    const updateResponse = await TestUtils.authenticatedRequest(app, authToken).patch(`${endpoint}/${createdId}`).send(updateData).expect(200);

    TestUtils.assertResponseStructure(updateResponse.body, requiredFields);

    // Test DELETE
    await TestUtils.authenticatedRequest(app, authToken).delete(`${endpoint}/${createdId}`).expect(200);

    // Verify deletion
    await TestUtils.authenticatedRequest(app, authToken).get(`${endpoint}/${createdId}`).expect(404);

    return createdId;
  }

  /**
   * Test pagination
   */
  static async testPagination(app: INestApplication, endpoint: string, authToken: string, pageSize = 10) {
    const response = await TestUtils.authenticatedRequest(app, authToken).get(endpoint).query({ limit: pageSize, page: 1 }).expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta');
    expect(response.body.meta).toHaveProperty('currentPage');
    expect(response.body.meta).toHaveProperty('totalPages');
    expect(response.body.meta).toHaveProperty('totalItems');
    expect(response.body.meta).toHaveProperty('itemsPerPage');
  }

  /**
   * Test input validation
   */
  static async testInputValidation(
    app: INestApplication,
    endpoint: string,
    method: 'post' | 'patch' | 'put',
    authToken: string,
    validData: any,
    invalidFields: Array<{ field: string; value: any; expectedError?: string }>
  ) {
    // Test with valid data first
    await TestUtils.authenticatedRequest(app, authToken)
      [method](endpoint)
      .send(validData)
      .expect(res => {
        expect(res.status).toBeGreaterThanOrEqual(200);
        expect(res.status).toBeLessThan(300);
      });

    // Test each invalid field
    for (const { field, value, expectedError } of invalidFields) {
      const invalidData = { ...validData, [field]: value };

      const response = await TestUtils.authenticatedRequest(app, authToken)[method](endpoint).send(invalidData);

      TestUtils.assertValidationError(response, expectedError);
    }
  }

  /**
   * Test authentication and authorization
   */
  static async testAuthenticationAndAuthorization(
    app: INestApplication,
    endpoint: string,
    method: 'get' | 'post' | 'patch' | 'delete',
    validToken: string,
    testData?: any
  ) {
    // Test without token
    let request = app.getHttpServer()[method](endpoint);

    if (testData && (method === 'post' || method === 'patch')) {
      request = request.send(testData);
    }

    const noTokenResponse = await request;
    TestUtils.assertUnauthorizedError(noTokenResponse);

    // Test with invalid token
    request = app.getHttpServer()[method](endpoint).set('Authorization', 'Bearer invalid-token');

    if (testData && (method === 'post' || method === 'patch')) {
      request = request.send(testData);
    }

    const invalidTokenResponse = await request;
    TestUtils.assertUnauthorizedError(invalidTokenResponse);

    // Test with valid token should work
    request = TestUtils.authenticatedRequest(app, validToken)[method](endpoint);

    if (testData && (method === 'post' || method === 'patch')) {
      request = request.send(testData);
    }

    const validTokenResponse = await request;
    expect(validTokenResponse.status).not.toBe(401);
  }
}
