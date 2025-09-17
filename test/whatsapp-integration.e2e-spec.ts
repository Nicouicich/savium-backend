import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { WhatsappModule } from '../src/integrations/whatsapp/whatsapp.module';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import { UserProfile, UserProfileSchema } from '../src/users/schemas/user-profile.schema';
import { RequestContextService } from '@common/interceptors/request-context';

describe('WhatsApp Integration (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test'
        }),
        MongooseModule.forRoot('mongodb://localhost:27017/savium-test'),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: UserProfile.name, schema: UserProfileSchema }
        ]),
        WhatsappModule
      ]
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe
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

  describe('/integrations/whatsapp/status (GET)', () => {
    it('should return service status', () => {
      return request(app.getHttpServer())
        .get('/integrations/whatsapp/status')
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('enabled');
          expect(res.body).toHaveProperty('features');
          expect(res.body).toHaveProperty('configuration');
          expect(res.body.configuration).toHaveProperty('hasAccessToken');
          expect(res.body.configuration).toHaveProperty('hasPhoneNumberId');
          expect(res.body.configuration).toHaveProperty('hasVerifyToken');
        });
    });
  });

  describe('/integrations/whatsapp/webhook (GET)', () => {
    it('should return OK for health check', () => {
      return request(app.getHttpServer())
        .get('/integrations/whatsapp/webhook')
        .expect(200)
        .expect(res => {
          expect(res.body).toEqual({
            status: 'ok',
            message: 'WhatsApp webhook endpoint is ready',
            timestamp: expect.any(String)
          });
        });
    });

    it('should verify webhook with correct parameters', () => {
      const mode = 'subscribe';
      const verifyToken = 'test-verify-token';
      const challenge = 'test-challenge-123';

      // Mock the config service to return the expected verify token
      process.env.WHATSAPP_VERIFY_TOKEN = verifyToken;

      return request(app.getHttpServer())
        .get('/integrations/whatsapp/webhook')
        .query({
          'hub.mode': mode,
          'hub.verify_token': verifyToken,
          'hub.challenge': challenge
        })
        .expect(200)
        .expect(challenge);
    });

    it('should reject webhook with incorrect token', () => {
      const mode = 'subscribe';
      const verifyToken = 'wrong-token';
      const challenge = 'test-challenge-123';

      process.env.WHATSAPP_VERIFY_TOKEN = 'correct-token';

      return request(app.getHttpServer())
        .get('/integrations/whatsapp/webhook')
        .query({
          'hub.mode': mode,
          'hub.verify_token': verifyToken,
          'hub.challenge': challenge
        })
        .expect(500); // Should throw error for failed verification
    });
  });

  describe('/integrations/whatsapp/webhook (POST)', () => {
    it('should handle valid webhook payload', () => {
      const validPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { phone_number_id: 'test-phone-id' },
                  messages: [
                    {
                      from: '1234567890',
                      id: 'msg-123',
                      timestamp: '1640995200',
                      text: {
                        body: 'gasté 25 en almuerzo'
                      },
                      type: 'text'
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      return request(app.getHttpServer())
        .post('/integrations/whatsapp/webhook')
        .send(validPayload)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('processed');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('traceId');
        });
    });

    it('should handle invalid webhook payload', () => {
      const invalidPayload = {
        invalid: 'payload'
      };

      return request(app.getHttpServer())
        .post('/integrations/whatsapp/webhook')
        .send(invalidPayload)
        .expect(200)
        .expect(res => {
          expect(res.body.processed).toBe(false);
          expect(res.body.message).toBe('Invalid webhook payload structure');
        });
    });

    it('should handle webhook with status updates', () => {
      const statusPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [
                    {
                      id: 'msg-123',
                      status: 'delivered',
                      timestamp: '1640995200',
                      recipient_id: '1234567890'
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      return request(app.getHttpServer())
        .post('/integrations/whatsapp/webhook')
        .send(statusPayload)
        .expect(200)
        .expect(res => {
          expect(res.body.processed).toBe(true);
        });
    });
  });

  describe('/integrations/whatsapp/send (POST)', () => {
    it('should send message with valid parameters', () => {
      const sendRequest = {
        to: '+1234567890',
        message: 'Hello from Savium test!'
      };

      return request(app.getHttpServer())
        .post('/integrations/whatsapp/send')
        .send(sendRequest)
        .expect(200)
        .expect(res => {
          expect(res.body).toEqual({
            success: true,
            message: 'Message sent successfully',
            to: '+1234567890',
            timestamp: expect.any(String),
            traceId: expect.any(String)
          });
        });
    });

    it('should reject message with missing phone number', () => {
      const sendRequest = {
        message: 'Hello from Savium test!'
      };

      return request(app.getHttpServer())
        .post('/integrations/whatsapp/send')
        .send(sendRequest)
        .expect(400)
        .expect(res => {
          expect(res.body.success).toBe(false);
          expect(res.body.errorCode).toBe('VAL_001');
        });
    });

    it('should reject message with invalid phone format', () => {
      const sendRequest = {
        to: 'invalid-phone',
        message: 'Hello from Savium test!'
      };

      return request(app.getHttpServer())
        .post('/integrations/whatsapp/send')
        .send(sendRequest)
        .expect(400)
        .expect(res => {
          expect(res.body.success).toBe(false);
          expect(res.body.errorCode).toBe('VAL_001');
        });
    });

    it('should reject message with missing message text', () => {
      const sendRequest = {
        to: '+1234567890'
      };

      return request(app.getHttpServer())
        .post('/integrations/whatsapp/send')
        .send(sendRequest)
        .expect(400)
        .expect(res => {
          expect(res.body.success).toBe(false);
          expect(res.body.errorCode).toBe('VAL_001');
        });
    });

    it('should handle various valid international phone formats', async () => {
      const validPhoneNumbers = [
        '+1234567890', // US
        '+441234567890', // UK
        '+5491123456789', // Argentina
        '+8613800000000' // China
      ];

      for (const phoneNumber of validPhoneNumbers) {
        await request(app.getHttpServer())
          .post('/integrations/whatsapp/send')
          .send({
            to: phoneNumber,
            message: 'Test message'
          })
          .expect(200);
      }
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed JSON in webhook', () => {
      return request(app.getHttpServer()).post('/integrations/whatsapp/webhook').send('invalid-json').expect(400); // Should be handled by NestJS body parser
    });

    it('should handle webhook with null entry', () => {
      const payloadWithNullEntry = {
        object: 'whatsapp_business_account',
        entry: null
      };

      return request(app.getHttpServer())
        .post('/integrations/whatsapp/webhook')
        .send(payloadWithNullEntry)
        .expect(200)
        .expect(res => {
          expect(res.body.processed).toBe(false);
          expect(res.body.message).toBe('Invalid webhook payload structure');
        });
    });

    it('should handle webhook with empty entry array', () => {
      const payloadWithEmptyEntry = {
        object: 'whatsapp_business_account',
        entry: []
      };

      return request(app.getHttpServer())
        .post('/integrations/whatsapp/webhook')
        .send(payloadWithEmptyEntry)
        .expect(200)
        .expect(res => {
          expect(res.body.processed).toBe(true);
        });
    });
  });

  describe('Request tracing', () => {
    it('should include trace ID in responses', () => {
      return request(app.getHttpServer())
        .get('/integrations/whatsapp/status')
        .expect(200)
        .expect(res => {
          // The trace ID should be in the response headers
          expect(res.headers['x-trace-id']).toBeDefined();
        });
    });

    it('should maintain trace ID across webhook processing', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: []
      };

      return request(app.getHttpServer())
        .post('/integrations/whatsapp/webhook')
        .send(payload)
        .expect(200)
        .expect(res => {
          expect(res.body.traceId).toBeDefined();
          expect(typeof res.body.traceId).toBe('string');
        });
    });
  });
});
