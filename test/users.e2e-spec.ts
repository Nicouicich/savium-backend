import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import { CreateUserDto } from '../src/users/dto/create-user.dto';
import { UpdateUserDto } from '../src/users/dto/update-user.dto';
import { UsersModule } from '../src/users/users.module';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let createdUserId: string;

  const testUser: CreateUserDto = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: 'password123'
  };

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true
        }),
        MongooseModule.forRoot(mongoUri),
        UsersModule
      ]
    }).compile();

    app = moduleFixture.createNestApplication();

    // Add validation pipe to match production setup
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
    await mongoServer.stop();
  });

  describe('POST /users', () => {
    it('should create a new user successfully', async () => {
      const response = await request(app.getHttpServer()).post('/users').send(testUser).expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(testUser.email.toLowerCase());
      expect(response.body.firstName).toBe(testUser.firstName);
      expect(response.body.lastName).toBe(testUser.lastName);
      expect(response.body).not.toHaveProperty('password');
      expect(response.body.status).toBe('pending_verification');

      createdUserId = response.body.id;
    });

    it('should return 400 for invalid email format', async () => {
      const invalidUser = { ...testUser, email: 'invalid-email' };

      await request(app.getHttpServer()).post('/users').send(invalidUser).expect(400);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteUser = { email: 'incomplete@example.com' };

      await request(app.getHttpServer()).post('/users').send(incompleteUser).expect(400);
    });

    it('should return 409 for duplicate email', async () => {
      await request(app.getHttpServer()).post('/users').send(testUser).expect(409);
    });

    it('should return 400 for weak password', async () => {
      const weakPasswordUser = { ...testUser, email: 'weak@example.com', password: '123' };

      await request(app.getHttpServer()).post('/users').send(weakPasswordUser).expect(400);
    });
  });

  describe('GET /users/:id', () => {
    it('should get user by id', async () => {
      const response = await request(app.getHttpServer()).get(`/users/${createdUserId}`).expect(200);

      expect(response.body.id).toBe(createdUserId);
      expect(response.body.email).toBe(testUser.email.toLowerCase());
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await request(app.getHttpServer()).get(`/users/${nonExistentId}`).expect(404);
    });

    it('should return 400 for invalid ObjectId format', async () => {
      await request(app.getHttpServer()).get('/users/invalid-id').expect(400);
    });
  });

  describe('GET /users', () => {
    it('should get paginated list of users', async () => {
      const response = await request(app.getHttpServer()).get('/users').query({ page: 1, limit: 10 }).expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should filter users by status', async () => {
      const response = await request(app.getHttpServer()).get('/users').query({ status: 'pending_verification' }).expect(200);

      expect(response.body.users.every(user => user.status === 'pending_verification')).toBe(true);
    });

    it('should handle empty results gracefully', async () => {
      const response = await request(app.getHttpServer()).get('/users').query({ status: 'non_existent_status' }).expect(200);

      expect(response.body.users).toEqual([]);
      expect(response.body.total).toBe(0);
    });
  });

  describe('PATCH /users/:id', () => {
    it('should update user successfully', async () => {
      const updateData: UpdateUserDto = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await request(app.getHttpServer()).patch(`/users/${createdUserId}`).send(updateData).expect(200);

      expect(response.body.firstName).toBe(updateData.firstName);
      expect(response.body.lastName).toBe(updateData.lastName);
      expect(response.body.id).toBe(createdUserId);
    });

    it('should return 404 for non-existent user update', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const updateData = { firstName: 'Updated' };

      await request(app.getHttpServer()).patch(`/users/${nonExistentId}`).send(updateData).expect(404);
    });

    it('should validate update data', async () => {
      const invalidUpdateData = { email: 'invalid-email-format' };

      await request(app.getHttpServer()).patch(`/users/${createdUserId}`).send(invalidUpdateData).expect(400);
    });

    it('should update user preferences', async () => {
      const preferencesUpdate = {
        preferences: {
          notifications: {
            email: false,
            push: true
          },
          display: {
            theme: 'dark'
          }
        }
      };

      const response = await request(app.getHttpServer()).patch(`/users/${createdUserId}`).send(preferencesUpdate).expect(200);

      expect(response.body.preferences.notifications.email).toBe(false);
      expect(response.body.preferences.display.theme).toBe('dark');
    });
  });

  describe('POST /users/:id/password', () => {
    it('should update user password', async () => {
      const passwordUpdate = { newPassword: 'newPassword123' };

      await request(app.getHttpServer()).post(`/users/${createdUserId}/password`).send(passwordUpdate).expect(200);
    });

    it('should return 400 for weak new password', async () => {
      const weakPassword = { newPassword: '123' };

      await request(app.getHttpServer()).post(`/users/${createdUserId}/password`).send(weakPassword).expect(400);
    });

    it('should return 404 for non-existent user password update', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const passwordUpdate = { newPassword: 'newPassword123' };

      await request(app.getHttpServer()).post(`/users/${nonExistentId}/password`).send(passwordUpdate).expect(404);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should soft delete user successfully', async () => {
      const response = await request(app.getHttpServer()).delete(`/users/${createdUserId}`).expect(200);

      expect(response.body.message).toBe('User deleted successfully');

      // Verify user is soft deleted (deactivated)
      const userResponse = await request(app.getHttpServer()).get(`/users/${createdUserId}`).expect(200);

      expect(userResponse.body.isActive).toBe(false);
      expect(userResponse.body.status).toBe('deactivated');
    });

    it('should return 404 for non-existent user deletion', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await request(app.getHttpServer()).delete(`/users/${nonExistentId}`).expect(404);
    });
  });

  describe('GET /users/stats', () => {
    it('should return user statistics', async () => {
      const response = await request(app.getHttpServer()).get('/users/stats').expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('active');
      expect(response.body).toHaveProperty('verified');
      expect(response.body).toHaveProperty('byRole');
      expect(response.body).toHaveProperty('byStatus');
      expect(typeof response.body.total).toBe('number');
    });
  });

  describe('User Profile Integration', () => {
    let activeUserId: string;

    beforeAll(async () => {
      // Create a user for profile testing
      const profileTestUser = {
        firstName: 'Profile',
        lastName: 'Test',
        email: 'profile@example.com',
        password: 'password123'
      };

      const response = await request(app.getHttpServer()).post('/users').send(profileTestUser).expect(201);

      activeUserId = response.body.id;
    });

    it('should create user with default profile', async () => {
      const response = await request(app.getHttpServer()).get(`/users/${activeUserId}`).expect(200);

      expect(response.body).toHaveProperty('profiles');
      expect(response.body.profiles.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('activeProfileId');
    });

    it('should handle user creation with custom profile data', async () => {
      const userWithProfile = {
        firstName: 'Custom',
        lastName: 'Profile',
        email: 'custom@example.com',
        password: 'password123',
        profile: {
          name: 'Custom Profile Name',
          profileType: 'business',
          bio: 'Test bio'
        }
      };

      const response = await request(app.getHttpServer()).post('/users').send(userWithProfile).expect(201);

      expect(response.body.id).toBeDefined();

      // Verify profile was created with custom data
      const userDetails = await request(app.getHttpServer()).get(`/users/${response.body.id}`).expect(200);

      expect(userDetails.body.profiles.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent user creation attempts with same email', async () => {
      const duplicateUser = {
        firstName: 'Concurrent',
        lastName: 'Test',
        email: 'concurrent@example.com',
        password: 'password123'
      };

      // Attempt to create the same user concurrently
      const promises = Array(3)
        .fill(null)
        .map(() => request(app.getHttpServer()).post('/users').send(duplicateUser));

      const results = await Promise.allSettled(promises);

      // Only one should succeed (201), others should fail with conflict (409)
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 201);
      const conflicts = results.filter(r => r.status === 'fulfilled' && r.value.status === 409);

      expect(successful.length).toBe(1);
      expect(conflicts.length).toBe(2);
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should sanitize and normalize email addresses', async () => {
      const userWithCapsEmail = {
        firstName: 'Caps',
        lastName: 'Email',
        email: 'CAPS.EMAIL@EXAMPLE.COM',
        password: 'password123'
      };

      const response = await request(app.getHttpServer()).post('/users').send(userWithCapsEmail).expect(201);

      expect(response.body.email).toBe('caps.email@example.com');
    });

    it('should trim whitespace from names', async () => {
      const userWithSpaces = {
        firstName: '  Spaced  ',
        lastName: '  Name  ',
        email: 'spaced@example.com',
        password: 'password123'
      };

      const response = await request(app.getHttpServer()).post('/users').send(userWithSpaces).expect(201);

      expect(response.body.firstName).toBe('Spaced');
      expect(response.body.lastName).toBe('Name');
    });

    it('should reject malicious input attempts', async () => {
      const maliciousUser = {
        firstName: '<script>alert("xss")</script>',
        lastName: 'Test',
        email: 'malicious@example.com',
        password: 'password123'
      };

      // The validation should reject this or sanitize it
      await request(app.getHttpServer()).post('/users').send(maliciousUser).expect(400);
    });
  });
});
