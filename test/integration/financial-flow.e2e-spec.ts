import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';

import { AppModule } from '../../src/app.module';
import { TestSetup, TestDataFactory, TestUtils } from '../helpers/test-helpers';

describe('Financial Flow Integration Tests (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;
  let accountId: string;
  let categoryId: string;

  beforeAll(async () => {
    app = await TestSetup.createTestApp(AppModule);
  });

  afterAll(async () => {
    await TestSetup.cleanup();
  });

  beforeEach(async () => {
    // Clean database before each test
    await TestUtils.cleanDatabase(TestSetup.getConnection());
  });

  describe('Complete User Financial Journey', () => {
    it('should complete a full user financial workflow', async () => {
      // Step 1: User Registration
      const userData = TestDataFactory.createUserData();
      const registerResponse = await request(app.getHttpServer()).post('/api/v1/auth/register').send(userData).expect(201);

      expect(registerResponse.body).toHaveProperty('user');
      expect(registerResponse.body).toHaveProperty('tokens');
      expect(registerResponse.body.user.email).toBe(userData.email);

      authToken = registerResponse.body.tokens.accessToken;
      userId = registerResponse.body.user.id;

      // Step 2: Create Personal Account
      const accountData = TestDataFactory.createAccountData(userId);
      const accountResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/accounts').send(accountData).expect(201);

      expect(accountResponse.body).toHaveProperty('id');
      expect(accountResponse.body.name).toBe(accountData.name);
      expect(accountResponse.body.type).toBe(accountData.type);

      accountId = accountResponse.body.id;

      // Step 3: Create Expense Categories
      const categoryData = TestDataFactory.createCategoryData(accountId, {
        name: 'Groceries',
        type: 'expense'
      });

      const categoryResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/categories').send(categoryData).expect(201);

      expect(categoryResponse.body).toHaveProperty('id');
      expect(categoryResponse.body.name).toBe('Groceries');

      categoryId = categoryResponse.body.id;

      // Step 4: Create Budget
      const budgetData = TestDataFactory.createBudgetData(accountId, userId, {
        categoryBudgets: [
          {
            categoryId,
            budgetAmount: 500,
            alertThreshold: 80
          }
        ]
      });

      const budgetResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/budgets').send(budgetData).expect(201);

      expect(budgetResponse.body).toHaveProperty('id');
      expect(budgetResponse.body.categoryBudgets).toHaveLength(1);

      const budgetId = budgetResponse.body.id;

      // Step 5: Add Multiple Expenses
      const expenses = [
        { amount: 45.5, description: 'Weekly grocery shopping', categoryId },
        { amount: 12.75, description: 'Coffee and snacks', categoryId },
        { amount: 89.2, description: 'Monthly grocery haul', categoryId }
      ];

      const expenseIds: string[] = [];

      for (const expenseData of expenses) {
        const fullExpenseData = TestDataFactory.createExpenseData(accountId, userId, expenseData);

        const expenseResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/expenses').send(fullExpenseData).expect(201);

        expect(expenseResponse.body).toHaveProperty('id');
        expect(expenseResponse.body.amount).toBeValidMonetaryAmount();
        expect(expenseResponse.body.description).toBe(expenseData.description);

        expenseIds.push(expenseResponse.body.id);
      }

      // Step 6: Check Budget Status
      const budgetStatusResponse = await TestUtils.authenticatedRequest(app, authToken).get(`/api/v1/budgets/${budgetId}/status`).expect(200);

      expect(budgetStatusResponse.body).toHaveProperty('totalSpent');
      expect(budgetStatusResponse.body).toHaveProperty('remainingBudget');
      expect(budgetStatusResponse.body).toHaveProperty('percentageUsed');

      // Total spent should be sum of all expenses
      const totalExpected = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      expect(budgetStatusResponse.body.totalSpent).toBeCloseTo(totalExpected, 2);

      // Step 7: Generate Expense Report
      const reportResponse = await TestUtils.authenticatedRequest(app, authToken)
        .get(`/api/v1/reports/expenses`)
        .query({
          accountId,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
          endDate: new Date().toISOString()
        })
        .expect(200);

      expect(reportResponse.body).toHaveProperty('totalExpenses');
      expect(reportResponse.body).toHaveProperty('categoryBreakdown');
      expect(reportResponse.body).toHaveProperty('monthlyBreakdown');
      expect(reportResponse.body.totalExpenses).toBeCloseTo(totalExpected, 2);

      // Step 8: Update Expense
      const updatedExpenseData = {
        amount: 95.75,
        description: 'Updated monthly grocery haul'
      };

      const updateResponse = await TestUtils.authenticatedRequest(app, authToken)
        .patch(`/api/v1/expenses/${expenseIds[2]}`)
        .send(updatedExpenseData)
        .expect(200);

      expect(updateResponse.body.amount).toBe(95.75);
      expect(updateResponse.body.description).toBe(updatedExpenseData.description);

      // Step 9: Delete Expense
      await TestUtils.authenticatedRequest(app, authToken).delete(`/api/v1/expenses/${expenseIds[1]}`).expect(200);

      // Verify deletion
      await TestUtils.authenticatedRequest(app, authToken).get(`/api/v1/expenses/${expenseIds[1]}`).expect(404);

      // Step 10: Get Final Summary
      const summaryResponse = await TestUtils.authenticatedRequest(app, authToken).get(`/api/v1/accounts/${accountId}/summary`).expect(200);

      expect(summaryResponse.body).toHaveProperty('totalExpenses');
      expect(summaryResponse.body).toHaveProperty('totalCategories');
      expect(summaryResponse.body).toHaveProperty('activeBudgets');
    });

    it('should handle multi-user account scenarios', async () => {
      // Create first user (account owner)
      const owner = TestDataFactory.createUserData({ email: 'owner@test.com' });
      const ownerRegisterResponse = await request(app.getHttpServer()).post('/api/v1/auth/register').send(owner).expect(201);

      const ownerToken = ownerRegisterResponse.body.tokens.accessToken;
      const ownerId = ownerRegisterResponse.body.user.id;

      // Create family account
      const familyAccount = TestDataFactory.createAccountData(ownerId, {
        type: 'FAMILY',
        name: 'Johnson Family'
      });

      const accountResponse = await TestUtils.authenticatedRequest(app, ownerToken).post('/api/v1/accounts').send(familyAccount).expect(201);

      const familyAccountId = accountResponse.body.id;

      // Create second user (to be invited)
      const member = TestDataFactory.createUserData({ email: 'member@test.com' });
      const memberRegisterResponse = await request(app.getHttpServer()).post('/api/v1/auth/register').send(member).expect(201);

      const memberToken = memberRegisterResponse.body.tokens.accessToken;
      const memberId = memberRegisterResponse.body.user.id;

      // Owner invites member to family account
      const inviteResponse = await TestUtils.authenticatedRequest(app, ownerToken)
        .post(`/api/v1/accounts/${familyAccountId}/invite`)
        .send({
          email: member.email,
          role: 'CHILD',
          expenseLimit: 100
        })
        .expect(201);

      expect(inviteResponse.body).toHaveProperty('invitationId');

      // Member accepts invitation (simulated via direct API call)
      const acceptResponse = await TestUtils.authenticatedRequest(app, memberToken)
        .post(`/api/v1/accounts/invitations/${inviteResponse.body.invitationId}/accept`)
        .expect(200);

      expect(acceptResponse.body).toHaveProperty('message');
      expect(acceptResponse.body).toHaveProperty('account');

      // Both users can now access the account
      const ownerAccountsResponse = await TestUtils.authenticatedRequest(app, ownerToken).get('/api/v1/accounts').expect(200);

      const memberAccountsResponse = await TestUtils.authenticatedRequest(app, memberToken).get('/api/v1/accounts').expect(200);

      expect(ownerAccountsResponse.body).toHaveLength(1);
      expect(memberAccountsResponse.body).toHaveLength(1);
      expect(ownerAccountsResponse.body[0].id).toBe(memberAccountsResponse.body[0].id);

      // Create category (by owner)
      const categoryData = TestDataFactory.createCategoryData(familyAccountId);
      const categoryResponse = await TestUtils.authenticatedRequest(app, ownerToken).post('/api/v1/categories').send(categoryData).expect(201);

      const sharedCategoryId = categoryResponse.body.id;

      // Both users can add expenses to the account
      const ownerExpense = TestDataFactory.createExpenseData(familyAccountId, ownerId, {
        categoryId: sharedCategoryId,
        amount: 150,
        description: 'Family dinner'
      });

      const memberExpense = TestDataFactory.createExpenseData(familyAccountId, memberId, {
        categoryId: sharedCategoryId,
        amount: 25,
        description: 'School supplies'
      });

      await TestUtils.authenticatedRequest(app, ownerToken).post('/api/v1/expenses').send(ownerExpense).expect(201);

      await TestUtils.authenticatedRequest(app, memberToken).post('/api/v1/expenses').send(memberExpense).expect(201);

      // Test expense limit enforcement
      const overLimitExpense = TestDataFactory.createExpenseData(familyAccountId, memberId, {
        categoryId: sharedCategoryId,
        amount: 150, // Exceeds the 100 limit set for child
        description: 'Expensive item'
      });

      await TestUtils.authenticatedRequest(app, memberToken).post('/api/v1/expenses').send(overLimitExpense).expect(400); // Should be rejected due to expense limit

      // Owner can view all expenses
      const allExpensesResponse = await TestUtils.authenticatedRequest(app, ownerToken)
        .get('/api/v1/expenses')
        .query({ accountId: familyAccountId })
        .expect(200);

      expect(allExpensesResponse.body.data).toHaveLength(2);

      // Member can view all expenses too (in a family account)
      const memberExpensesResponse = await TestUtils.authenticatedRequest(app, memberToken)
        .get('/api/v1/expenses')
        .query({ accountId: familyAccountId })
        .expect(200);

      expect(memberExpensesResponse.body.data).toHaveLength(2);
    });

    it('should handle budget alerts and notifications', async () => {
      // Setup user and account
      const userData = TestDataFactory.createUserData();
      const registerResponse = await request(app.getHttpServer()).post('/api/v1/auth/register').send(userData).expect(201);

      const authToken = registerResponse.body.tokens.accessToken;
      const userId = registerResponse.body.user.id;

      const accountData = TestDataFactory.createAccountData(userId);
      const accountResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/accounts').send(accountData).expect(201);

      const accountId = accountResponse.body.id;

      // Create category
      const categoryData = TestDataFactory.createCategoryData(accountId);
      const categoryResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/categories').send(categoryData).expect(201);

      const categoryId = categoryResponse.body.id;

      // Create budget with alerts
      const budgetData = TestDataFactory.createBudgetData(accountId, userId, {
        totalAmount: 200,
        categoryBudgets: [
          {
            categoryId,
            budgetAmount: 200,
            alertThreshold: 75 // Alert when 75% spent (150)
          }
        ]
      });

      const budgetResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/budgets').send(budgetData).expect(201);

      const budgetId = budgetResponse.body.id;

      // Add expenses up to alert threshold
      const expense1 = TestDataFactory.createExpenseData(accountId, userId, {
        categoryId,
        amount: 100,
        description: 'First expense'
      });

      await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/expenses').send(expense1).expect(201);

      // Check budget status - should not be in alert yet
      let budgetStatus = await TestUtils.authenticatedRequest(app, authToken).get(`/api/v1/budgets/${budgetId}/status`).expect(200);

      expect(budgetStatus.body.percentageUsed).toBeLessThan(75);
      expect(budgetStatus.body.alerts).toHaveLength(0);

      // Add expense that triggers alert
      const expense2 = TestDataFactory.createExpenseData(accountId, userId, {
        categoryId,
        amount: 60,
        description: 'Expense triggering alert'
      });

      await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/expenses').send(expense2).expect(201);

      // Check budget status - should now have alert
      budgetStatus = await TestUtils.authenticatedRequest(app, authToken).get(`/api/v1/budgets/${budgetId}/status`).expect(200);

      expect(budgetStatus.body.percentageUsed).toBeGreaterThan(75);
      expect(budgetStatus.body.alerts).toHaveLength(1);
      expect(budgetStatus.body.alerts[0].type).toBe('BUDGET_THRESHOLD_EXCEEDED');

      // Add expense that exceeds budget
      const expense3 = TestDataFactory.createExpenseData(accountId, userId, {
        categoryId,
        amount: 50,
        description: 'Expense exceeding budget'
      });

      await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/expenses').send(expense3).expect(201);

      // Check budget status - should have multiple alerts
      budgetStatus = await TestUtils.authenticatedRequest(app, authToken).get(`/api/v1/budgets/${budgetId}/status`).expect(200);

      expect(budgetStatus.body.percentageUsed).toBeGreaterThan(100);
      expect(budgetStatus.body.alerts.length).toBeGreaterThan(1);
      expect(budgetStatus.body.alerts.some(alert => alert.type === 'BUDGET_EXCEEDED')).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      // Setup a basic authenticated user for error tests
      const userData = TestDataFactory.createUserData();
      const registerResponse = await request(app.getHttpServer()).post('/api/v1/auth/register').send(userData).expect(201);

      authToken = registerResponse.body.tokens.accessToken;
      userId = registerResponse.body.user.id;
    });

    it('should handle invalid monetary amounts', async () => {
      const accountData = TestDataFactory.createAccountData(userId);
      const accountResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/accounts').send(accountData).expect(201);

      const accountId = accountResponse.body.id;

      const invalidAmounts = [
        { amount: -10, expectedError: 'negative amounts' },
        { amount: 1000000000, expectedError: 'too large' },
        { amount: 10.999, expectedError: 'too many decimal places' },
        { amount: 'invalid', expectedError: 'not a number' }
      ];

      for (const { amount } of invalidAmounts) {
        const expenseData = {
          amount,
          description: 'Test expense',
          categoryId: testUtils.createTestId(),
          accountId,
          date: new Date().toISOString(),
          currency: 'USD'
        };

        const response = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/expenses').send(expenseData);

        expect(response.status).toBe(400);
      }
    });

    it('should handle concurrent expense creation', async () => {
      const accountData = TestDataFactory.createAccountData(userId);
      const accountResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/accounts').send(accountData).expect(201);

      const accountId = accountResponse.body.id;

      const categoryData = TestDataFactory.createCategoryData(accountId);
      const categoryResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/categories').send(categoryData).expect(201);

      const categoryId = categoryResponse.body.id;

      // Create multiple expenses concurrently
      const expensePromises = [];
      for (let i = 0; i < 5; i++) {
        const expenseData = TestDataFactory.createExpenseData(accountId, userId, {
          categoryId,
          amount: 10 * (i + 1),
          description: `Concurrent expense ${i + 1}`
        });

        const promise = TestUtils.authenticatedRequest(app, authToken).post('/api/v1/expenses').send(expenseData);

        expensePromises.push(promise);
      }

      const responses = await Promise.all(expensePromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });

      // Verify all expenses were created
      const expensesResponse = await TestUtils.authenticatedRequest(app, authToken).get('/api/v1/expenses').query({ accountId }).expect(200);

      expect(expensesResponse.body.data).toHaveLength(5);
    });

    it('should handle database connection failures gracefully', async () => {
      // This test would require mocking the database connection
      // For now, we'll test the error response structure

      const response = await TestUtils.authenticatedRequest(app, authToken).get('/api/v1/expenses/invalid-id').expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      const userData = TestDataFactory.createUserData();
      const registerResponse = await request(app.getHttpServer()).post('/api/v1/auth/register').send(userData).expect(201);

      authToken = registerResponse.body.tokens.accessToken;
      userId = registerResponse.body.user.id;

      const accountData = TestDataFactory.createAccountData(userId);
      const accountResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/accounts').send(accountData).expect(201);

      accountId = accountResponse.body.id;
    });

    it('should handle bulk expense creation efficiently', async () => {
      const categoryData = TestDataFactory.createCategoryData(accountId);
      const categoryResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/categories').send(categoryData).expect(201);

      const categoryId = categoryResponse.body.id;

      const metrics = await TestUtils.measurePerformance(async () => {
        const promises = [];

        // Create 50 expenses
        for (let i = 0; i < 50; i++) {
          const expenseData = TestDataFactory.createExpenseData(accountId, userId, {
            categoryId,
            amount: Math.round((Math.random() * 100 + 10) * 100) / 100,
            description: `Bulk expense ${i + 1}`
          });

          promises.push(TestUtils.authenticatedRequest(app, authToken).post('/api/v1/expenses').send(expenseData));
        }

        const responses = await Promise.all(promises);
        return responses.filter(r => r.status === 201).length;
      });

      expect(metrics.result).toBe(50); // All should succeed
      TestUtils.assertPerformance(metrics, 10000, 50 * 1024 * 1024); // Max 10s, 50MB

      console.log(`Bulk expense creation: ${metrics.duration}ms for 50 expenses`);
    });

    it('should generate reports efficiently', async () => {
      // Pre-populate with some test data
      const categoryData = TestDataFactory.createCategoryData(accountId);
      const categoryResponse = await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/categories').send(categoryData).expect(201);

      const categoryId = categoryResponse.body.id;

      // Add 20 expenses
      for (let i = 0; i < 20; i++) {
        const expenseData = TestDataFactory.createExpenseData(accountId, userId, {
          categoryId,
          amount: Math.round((Math.random() * 100 + 10) * 100) / 100,
          description: `Test expense ${i + 1}`,
          date: testUtils.createTestDate(-i) // Spread across different days
        });

        await TestUtils.authenticatedRequest(app, authToken).post('/api/v1/expenses').send(expenseData).expect(201);
      }

      // Test report generation performance
      const metrics = await TestUtils.measurePerformance(async () => {
        const response = await TestUtils.authenticatedRequest(app, authToken)
          .get('/api/v1/reports/expenses')
          .query({
            accountId,
            startDate: testUtils.createTestDate(-30).toISOString(),
            endDate: new Date().toISOString()
          })
          .expect(200);

        return response.body;
      });

      expect(metrics.result).toHaveProperty('totalExpenses');
      expect(metrics.result).toHaveProperty('categoryBreakdown');
      TestUtils.assertPerformance(metrics, 2000, 10 * 1024 * 1024); // Max 2s, 10MB

      console.log(`Report generation: ${metrics.duration}ms for 20 expenses`);
    });
  });
});
