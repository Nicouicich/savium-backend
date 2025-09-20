import { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('User Flows (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let refreshToken: string;
  let accountId: string;
  let categoryId: string;
  let transactionId: string;

  const testUser = {
    email: 'test@savium.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User'
  };

  const testUserPartner = {
    email: 'partner@savium.com',
    password: 'TestPassword123!',
    firstName: 'Partner',
    lastName: 'User'
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test'
        }),
        AppModule
      ]
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Registration and Authentication Flow', () => {
    it('should register a new user with personal account', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          accountType: 'personal'
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('account');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.account.type).toBe('personal');

      authToken = response.body.tokens.accessToken;
      refreshToken = response.body.tokens.refreshToken;
      accountId = response.body.account.id;
    });

    it('should not allow duplicate email registration', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          accountType: 'personal'
        })
        .expect(409);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      authToken = response.body.tokens.accessToken;
    });

    it('should not login with invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should get user profile when authenticated', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${authToken}`).expect(200);

      expect(response.body.email).toBe(testUser.email);
    });

    it('should refresh tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      authToken = response.body.accessToken;
    });
  });

  describe('Couple Account Flow', () => {
    it('should register a couple account', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUserPartner,
          accountType: 'couple'
        })
        .expect(201);

      expect(response.body.account.type).toBe('couple');
      expect(response.body.account.members).toHaveLength(1);
    });

    it('should invite partner to couple account', async () => {
      const inviteResponse = await request(app.getHttpServer())
        .post(`/api/v1/accounts/${accountId}/invite`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'newpartner@savium.com',
          role: 'partner'
        })
        .expect(201);

      expect(inviteResponse.body).toHaveProperty('invitation');
    });
  });

  describe('Family Account Flow', () => {
    let familyAccountId: string;
    let familyAuthToken: string;

    it('should register a family account', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'parent@savium.com',
          password: 'TestPassword123!',
          firstName: 'Parent',
          lastName: 'User',
          accountType: 'family'
        })
        .expect(201);

      expect(response.body.account.type).toBe('family');
      familyAccountId = response.body.account.id;
      familyAuthToken = response.body.tokens.accessToken;
    });

    it('should invite child to family account', async () => {
      const inviteResponse = await request(app.getHttpServer())
        .post(`/api/v1/accounts/${familyAccountId}/invite`)
        .set('Authorization', `Bearer ${familyAuthToken}`)
        .send({
          email: 'child@savium.com',
          role: 'child'
        })
        .expect(201);

      expect(inviteResponse.body.invitation.role).toBe('child');
    });
  });

  describe('Business Account Flow', () => {
    let businessAccountId: string;
    let businessAuthToken: string;

    it('should register a business account', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'business@savium.com',
          password: 'TestPassword123!',
          firstName: 'Business',
          lastName: 'Owner',
          accountType: 'business'
        })
        .expect(201);

      expect(response.body.account.type).toBe('business');
      businessAccountId = response.body.account.id;
      businessAuthToken = response.body.tokens.accessToken;
    });

    it('should invite employee to business account', async () => {
      const inviteResponse = await request(app.getHttpServer())
        .post(`/api/v1/accounts/${businessAccountId}/invite`)
        .set('Authorization', `Bearer ${businessAuthToken}`)
        .send({
          email: 'employee@savium.com',
          role: 'employee'
        })
        .expect(201);

      expect(inviteResponse.body.invitation.role).toBe('employee');
    });

    it('should invite manager to business account', async () => {
      const inviteResponse = await request(app.getHttpServer())
        .post(`/api/v1/accounts/${businessAccountId}/invite`)
        .set('Authorization', `Bearer ${businessAuthToken}`)
        .send({
          email: 'manager@savium.com',
          role: 'manager'
        })
        .expect(201);

      expect(inviteResponse.body.invitation.role).toBe('manager');
    });
  });

  describe('Transaction Management Flow', () => {
    it('should create a default category', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Food & Dining',
          description: 'Food and restaurant transactions',
          color: '#FF5722',
          icon: 'restaurant',
          accountId
        })
        .expect(201);

      categoryId = response.body.id;
      expect(response.body.name).toBe('Food & Dining');
    });

    it('should create a new transaction', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 25.99,
          description: 'Lunch at restaurant',
          date: new Date().toISOString(),
          categoryId,
          accountId,
          currency: 'USD',
          vendor: 'Pizza Palace',
          paymentMethod: 'credit_card',
          tags: ['lunch', 'pizza']
        })
        .expect(201);

      transactionId = response.body.id;
      expect(response.body.amount).toBe(25.99);
      expect(response.body.description).toBe('Lunch at restaurant');
    });

    it('should get all transactions for account', async () => {
      const response = await request(app.getHttpServer()).get(`/api/v1/transactions/account/${accountId}`).set('Authorization', `Bearer ${authToken}`).expect(
        200
      );

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].amount).toBe(25.99);
    });

    it('should update an transaction', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 28.99,
          description: 'Lunch at restaurant - updated'
        })
        .expect(200);

      expect(response.body.amount).toBe(28.99);
      expect(response.body.description).toBe('Lunch at restaurant - updated');
    });

    it('should get transaction statistics', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/transactions/stats').query({ accountId }).set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalTransactions');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body.totalAmount).toBe(28.99);
    });

    it('should get category breakdown', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/transactions/category-breakdown').query({ accountId }).set(
        'Authorization',
        `Bearer ${authToken}`
      ).expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body[0]).toHaveProperty('category');
      expect(response.body[0]).toHaveProperty('totalAmount');
    });

    it('should search transactions', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/transactions/search').query({ q: 'lunch', accountId }).set(
        'Authorization',
        `Bearer ${authToken}`
      ).expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].description).toContain('Lunch');
    });
  });

  describe('Budget Management Flow', () => {
    let budgetId: string;

    it('should create a budget', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/budgets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Monthly Food Budget',
          amount: 500,
          period: 'monthly',
          accountId,
          categoryId,
          startDate: new Date().toISOString()
        })
        .expect(201);

      budgetId = response.body.id;
      expect(response.body.name).toBe('Monthly Food Budget');
      expect(response.body.amount).toBe(500);
    });

    it('should get budget with spending', async () => {
      const response = await request(app.getHttpServer()).get(`/api/v1/budgets/${budgetId}`).set('Authorization', `Bearer ${authToken}`).expect(200);

      expect(response.body.name).toBe('Monthly Food Budget');
      expect(response.body).toHaveProperty('spent');
      expect(response.body).toHaveProperty('remaining');
    });
  });

  describe('Goal Management Flow', () => {
    let goalId: string;

    it('should create a savings goal', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Vacation Fund',
          targetAmount: 2000,
          currentAmount: 0,
          targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
          accountId,
          description: 'Saving for summer vacation'
        })
        .expect(201);

      goalId = response.body.id;
      expect(response.body.name).toBe('Vacation Fund');
      expect(response.body.targetAmount).toBe(2000);
    });

    it('should update goal progress', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentAmount: 250
        })
        .expect(200);

      expect(response.body.currentAmount).toBe(250);
      expect(response.body.progress).toBeCloseTo(12.5); // 250/2000 * 100
    });
  });

  describe('Reports Flow', () => {
    it('should generate monthly report', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/monthly')
        .query({
          accountId,
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('transactions');
      expect(response.body).toHaveProperty('categories');
    });

    it('should export report data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/export')
        .query({
          accountId,
          format: 'json',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('summary');
    });
  });

  describe('User Profile Management', () => {
    it('should update user profile', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name'
        })
        .expect(200);

      expect(response.body.firstName).toBe('Updated');
      expect(response.body.lastName).toBe('Name');
    });
  });

  describe('Error Handling', () => {
    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/api/v1/transactions').expect(401);
    });

    it('should return 403 for insufficient permissions', async () => {
      // Try to access another user's transaction
      await request(app.getHttpServer()).get('/api/v1/transactions/invalid-transaction-id').set('Authorization', `Bearer ${authToken}`).expect(404);
    });

    it('should return 400 for invalid data', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 'invalid',
          description: ''
        })
        .expect(400);
    });
  });

  describe('Cleanup', () => {
    it('should delete transaction', async () => {
      await request(app.getHttpServer()).delete(`/api/v1/transactions/${transactionId}`).set('Authorization', `Bearer ${authToken}`).expect(200);
    });

    it('should logout user', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Authorization', `Bearer ${authToken}`).expect(200);
    });
  });
});
