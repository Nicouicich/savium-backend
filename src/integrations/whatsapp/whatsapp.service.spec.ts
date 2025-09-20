import { RequestContextService } from '@common/interceptors/request-context';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../../accounts/accounts.service';
import { MessagingFileService } from '../../files/services/messaging-file.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { UserProfile } from '../../users/schemas/user-profile.schema';
import { User } from '../../users/schemas/user.schema';
import { MessageProcessorService } from '../ai/message-processor.service';
import { ReceiptProcessorService } from '../ai/receipt-processor.service';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService', () => {
  let service: WhatsappService;
  let userModel: any;
  let userProfileModel: any;
  let messageProcessor: MessageProcessorService;
  let transactionsService: TransactionsService;
  let accountsService: AccountsService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-123',
    phoneNumber: '+1234567890',
    preferences: {
      display: {
        language: 'es'
      }
    },
    accounts: ['account-123'],
    activeProfileId: 'profile-123'
  };

  const mockUserModel = {
    findOne: jest.fn(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn()
  };

  const mockUserProfileModel = {
    findById: jest.fn()
  };

  const mockMessageProcessor = {
    processMessage: jest.fn()
  };

  const mockTransactionsService = {
    create: jest.fn()
  };

  const mockAccountsService = {
    findByUser: jest.fn()
  };

  const mockConfigService = {
    get: jest.fn()
  };

  const mockMessagingFileService = {};
  const mockReceiptProcessorService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel
        },
        {
          provide: getModelToken(UserProfile.name),
          useValue: mockUserProfileModel
        },
        {
          provide: MessageProcessorService,
          useValue: mockMessageProcessor
        },
        {
          provide: MessagingFileService,
          useValue: mockMessagingFileService
        },
        {
          provide: ReceiptProcessorService,
          useValue: mockReceiptProcessorService
        },
        {
          provide: TransactionsService,
          useValue: mockTransactionsService
        },
        {
          provide: AccountsService,
          useValue: mockAccountsService
        },
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ]
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
    userModel = module.get(getModelToken(User.name));
    userProfileModel = module.get(getModelToken(UserProfile.name));
    messageProcessor = module.get<MessageProcessorService>(MessageProcessorService);
    transactionsService = module.get<TransactionsService>(TransactionsService);
    accountsService = module.get<AccountsService>(AccountsService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock RequestContextService
    jest.spyOn(RequestContextService, 'getTraceId').mockReturnValue('test-trace-id');
    jest.spyOn(RequestContextService, 'updateContext').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findUserByPhoneNumber', () => {
    it('should find user by WhatsApp phone number', async () => {
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUser)
        })
      });

      const result = await service.findUserByPhoneNumber('+1234567890');

      expect(result).toBe(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        'messagingIntegrations.whatsapp.phoneNumber': '+1234567890'
      });
    });

    it('should try multiple lookup strategies for phone number', async () => {
      // First strategy fails
      mockUserModel.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null)
        })
      });

      // Second strategy succeeds
      mockUserModel.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUser)
        })
      });

      const result = await service.findUserByPhoneNumber('+1234567890');

      expect(result).toBe(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledTimes(2);
    });

    it('should return null if no user found', async () => {
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null)
        })
      });

      const result = await service.findUserByPhoneNumber('+1234567890');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      const result = await service.findUserByPhoneNumber('+1234567890');

      expect(result).toBeNull();
    });
  });

  describe('processMessage', () => {
    const mockMessage = {
      from: '+1234567890',
      body: 'gasté 25 en almuerzo',
      timestamp: new Date(),
      mediaType: 'text'
    };

    beforeEach(() => {
      // Mock sendMessage to avoid actual API calls
      jest.spyOn(service, 'sendMessage').mockResolvedValue();
    });

    it('should process message for known user', async () => {
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUser)
        })
      });

      mockMessageProcessor.processMessage.mockResolvedValue({
        success: true,
        responseText: 'Gasto registrado exitosamente',
        actionTaken: {
          type: 'transaction_created',
          data: { amount: 25, description: 'almuerzo' }
        }
      });

      await service.processMessage(mockMessage);

      expect(mockMessageProcessor.processMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '+1234567890',
          body: 'gasté 25 en almuerzo',
          platform: 'whatsapp',
          userId: 'user-123'
        })
      );

      expect(service.sendMessage).toHaveBeenCalledWith('+1234567890', 'Gasto registrado exitosamente');
    });

    it('should handle unknown user', async () => {
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null)
        })
      });

      await service.processMessage(mockMessage);

      expect(service.sendMessage).toHaveBeenCalledWith('+1234567890', expect.stringContaining('¡Hola! Parece que es tu primer mensaje'));
    });

    it('should handle message processing errors', async () => {
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUser)
        })
      });

      mockMessageProcessor.processMessage.mockRejectedValue(new Error('AI service error'));

      await service.processMessage(mockMessage);

      expect(service.sendMessage).toHaveBeenCalledWith('+1234567890', expect.stringContaining('Lo siento, hubo un problema'));
    });

    it('should handle AI processing errors gracefully', async () => {
      mockUserModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUser)
        })
      });

      mockMessageProcessor.processMessage.mockResolvedValue({
        success: false,
        error: 'AI processing failed',
        responseText: 'Error procesando mensaje'
      });

      await service.processMessage(mockMessage);

      expect(service.sendMessage).toHaveBeenCalledWith('+1234567890', 'Error procesando mensaje');
    });
  });

  describe('handleWebhook', () => {
    const mockWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-id',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {},
                messages: [
                  {
                    from: '1234567890',
                    timestamp: '1640995200',
                    text: {
                      body: 'gasté 30 en café'
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

    beforeEach(() => {
      jest.spyOn(service, 'processMessage').mockResolvedValue();
    });

    it('should process webhook with messages', async () => {
      const result = await service.handleWebhook(mockWebhookPayload);

      expect(result.processed).toBe(true);
      expect(service.processMessage).toHaveBeenCalledWith({
        from: '1234567890',
        body: 'gasté 30 en café',
        timestamp: new Date(1640995200 * 1000),
        mediaUrl: undefined,
        mediaType: 'text'
      });
    });

    it('should handle webhook without messages', async () => {
      const payloadWithoutMessages = {
        ...mockWebhookPayload,
        entry: [
          {
            ...mockWebhookPayload.entry[0],
            changes: [
              {
                ...mockWebhookPayload.entry[0].changes[0],
                value: {
                  ...mockWebhookPayload.entry[0].changes[0].value,
                  messages: undefined
                }
              }
            ]
          }
        ]
      };

      const result = await service.handleWebhook(payloadWithoutMessages);

      expect(result.processed).toBe(true);
      expect(service.processMessage).not.toHaveBeenCalled();
    });
  });

  describe('verifyWebhook', () => {
    beforeEach(() => {
      configService.get = jest.fn().mockReturnValue('test-verify-token');
    });

    it('should verify webhook with correct token', () => {
      const result = service.verifyWebhook('subscribe', 'test-verify-token', 'challenge-123');

      expect(result).toBe('challenge-123');
    });

    it('should reject webhook with incorrect token', () => {
      const result = service.verifyWebhook('subscribe', 'wrong-token', 'challenge-123');

      expect(result).toBeNull();
    });

    it('should reject webhook with incorrect mode', () => {
      const result = service.verifyWebhook('unsubscribe', 'test-verify-token', 'challenge-123');

      expect(result).toBeNull();
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      configService.get = jest
        .fn()
        .mockReturnValueOnce('test-access-token') // WHATSAPP_ACCESS_TOKEN
        .mockReturnValueOnce('test-phone-id'); // WHATSAPP_PHONE_NUMBER_ID
    });

    it('should log message when credentials not configured', async () => {
      configService.get = jest.fn().mockReturnValue(undefined);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.sendMessage('+1234567890', 'Test message');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[MOCK] WhatsApp message to +1234567890: Test message'));

      consoleSpy.mockRestore();
    });

    // Note: Testing actual HTTP calls would require mocking axios
    // This is covered in integration tests
  });

  describe('getServiceStatus', () => {
    it('should return enabled status when credentials are configured', () => {
      configService.get = jest.fn().mockReturnValueOnce('test-access-token').mockReturnValueOnce('test-phone-id').mockReturnValueOnce('test-verify-token');

      const status = service.getServiceStatus();

      expect(status.enabled).toBe(true);
      expect(status.configuration.hasAccessToken).toBe(true);
      expect(status.configuration.hasPhoneNumberId).toBe(true);
      expect(status.configuration.hasVerifyToken).toBe(true);
    });

    it('should return disabled status when credentials are missing', () => {
      configService.get = jest.fn().mockReturnValue(undefined);

      const status = service.getServiceStatus();

      expect(status.enabled).toBe(false);
      expect(status.configuration.hasAccessToken).toBe(false);
      expect(status.configuration.hasPhoneNumberId).toBe(false);
      expect(status.configuration.hasVerifyToken).toBe(false);
    });
  });
});
