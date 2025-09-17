import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { RequestContextService } from '@common/interceptors/request-context';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-codes';

describe('WhatsappController', () => {
  let controller: WhatsappController;
  let whatsappService: WhatsappService;

  const mockWhatsappService = {
    getServiceStatus: jest.fn(),
    verifyWebhook: jest.fn(),
    handleWebhook: jest.fn(),
    sendMessage: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappController],
      providers: [
        {
          provide: WhatsappService,
          useValue: mockWhatsappService
        }
      ]
    }).compile();

    controller = module.get<WhatsappController>(WhatsappController);
    whatsappService = module.get<WhatsappService>(WhatsappService);

    // Mock RequestContextService
    jest.spyOn(RequestContextService, 'getTraceId').mockReturnValue('test-trace-id');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return service status', async () => {
      const mockStatus = {
        enabled: true,
        features: ['messaging', 'webhooks'],
        configuration: {
          hasAccessToken: true,
          hasPhoneNumberId: true,
          hasVerifyToken: true
        }
      };

      mockWhatsappService.getServiceStatus.mockReturnValue(mockStatus);

      const result = await controller.getStatus();

      expect(result).toBe(mockStatus);
      expect(whatsappService.getServiceStatus).toHaveBeenCalled();
    });
  });

  describe('verifyWebhook', () => {
    it('should verify webhook with correct parameters', async () => {
      mockWhatsappService.verifyWebhook.mockReturnValue('challenge-123');

      const result = await controller.verifyWebhook('subscribe', 'valid-token', 'challenge-123');

      expect(result).toBe('challenge-123');
      expect(whatsappService.verifyWebhook).toHaveBeenCalledWith('subscribe', 'valid-token', 'challenge-123');
    });

    it('should return OK response when no parameters provided', async () => {
      const result = await controller.verifyWebhook();

      expect(result).toEqual({
        status: 'ok',
        message: 'WhatsApp webhook endpoint is ready',
        timestamp: expect.any(String)
      });
    });

    it('should throw error for failed verification', async () => {
      mockWhatsappService.verifyWebhook.mockReturnValue(null);

      await expect(controller.verifyWebhook('subscribe', 'invalid-token', 'challenge-123')).rejects.toThrow('Webhook verification failed');
    });

    it('should throw error for partial parameters', async () => {
      await expect(controller.verifyWebhook('subscribe', 'token')).rejects.toThrow('Invalid webhook verification request');
    });
  });

  describe('handleWebhook', () => {
    const validWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-123',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                messages: [
                  {
                    from: '1234567890',
                    text: { body: 'Hello world' },
                    timestamp: '1640995200'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };

    it('should handle valid webhook payload', async () => {
      const mockResult = {
        processed: true,
        message: 'Webhook processed successfully'
      };

      mockWhatsappService.handleWebhook.mockResolvedValue(mockResult);

      const result = await controller.handleWebhook(validWebhookPayload);

      expect(result).toEqual({
        ...mockResult,
        timestamp: expect.any(String),
        traceId: 'test-trace-id'
      });

      expect(whatsappService.handleWebhook).toHaveBeenCalledWith(validWebhookPayload);
    });

    it('should handle invalid webhook payload structure', async () => {
      const invalidPayload = { invalid: 'payload' };

      const result = await controller.handleWebhook(invalidPayload);

      expect(result).toEqual({
        processed: false,
        message: 'Invalid webhook payload structure',
        timestamp: expect.any(String),
        traceId: 'test-trace-id'
      });

      expect(whatsappService.handleWebhook).not.toHaveBeenCalled();
    });

    it('should handle webhook processing errors gracefully', async () => {
      mockWhatsappService.handleWebhook.mockRejectedValue(new Error('Processing failed'));

      const result = await controller.handleWebhook(validWebhookPayload);

      expect(result).toEqual({
        processed: false,
        message: 'Webhook processing failed',
        error: 'Processing failed',
        timestamp: expect.any(String),
        traceId: 'test-trace-id'
      });
    });

    it('should handle null/undefined payload', async () => {
      const result = await controller.handleWebhook(null);

      expect(result).toEqual({
        processed: false,
        message: 'Invalid webhook payload structure',
        timestamp: expect.any(String),
        traceId: 'test-trace-id'
      });
    });

    it('should handle payload without entry array', async () => {
      const payloadWithoutEntry = {
        object: 'whatsapp_business_account',
        entry: null
      };

      const result = await controller.handleWebhook(payloadWithoutEntry);

      expect(result).toEqual({
        processed: false,
        message: 'Invalid webhook payload structure',
        timestamp: expect.any(String),
        traceId: 'test-trace-id'
      });
    });
  });

  describe('sendMessage', () => {
    const validSendRequest = {
      to: '+1234567890',
      message: 'Hello from Savium!'
    };

    it('should send message successfully', async () => {
      mockWhatsappService.sendMessage.mockResolvedValue();

      const result = await controller.sendMessage(validSendRequest);

      expect(result).toEqual({
        success: true,
        message: 'Message sent successfully',
        to: '+1234567890',
        timestamp: expect.any(String),
        traceId: 'test-trace-id'
      });

      expect(whatsappService.sendMessage).toHaveBeenCalledWith('+1234567890', 'Hello from Savium!');
    });

    it('should validate required fields', async () => {
      const invalidRequest = { to: '', message: '' };

      await expect(controller.sendMessage(invalidRequest)).rejects.toThrow(BusinessException);

      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('should validate phone number format', async () => {
      const invalidPhoneRequest = {
        to: 'invalid-phone',
        message: 'Hello'
      };

      await expect(controller.sendMessage(invalidPhoneRequest)).rejects.toThrow(BusinessException);

      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle missing phone number', async () => {
      const requestWithoutPhone = {
        to: '',
        message: 'Hello'
      };

      try {
        await controller.sendMessage(requestWithoutPhone);
        fail('Should have thrown BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('should handle missing message', async () => {
      const requestWithoutMessage = {
        to: '+1234567890',
        message: ''
      };

      try {
        await controller.sendMessage(requestWithoutMessage);
        fail('Should have thrown BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('should handle service errors', async () => {
      mockWhatsappService.sendMessage.mockRejectedValue(new Error('WhatsApp API error'));

      try {
        await controller.sendMessage(validSendRequest);
        fail('Should have thrown BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.errorCode).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
      }
    });

    it('should validate international phone format', async () => {
      const validInternationalFormats = ['+1234567890', '+441234567890', '+5491123456789'];

      for (const phoneNumber of validInternationalFormats) {
        mockWhatsappService.sendMessage.mockResolvedValue();

        const result = await controller.sendMessage({
          to: phoneNumber,
          message: 'Test message'
        });

        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid phone formats', async () => {
      const invalidFormats = [
        '1234567890', // Missing +
        '+', // Just +
        '+abc123', // Contains letters
        '++123456789', // Double +
        '+1-234-567-890' // Contains dashes
      ];

      for (const phoneNumber of invalidFormats) {
        await expect(
          controller.sendMessage({
            to: phoneNumber,
            message: 'Test message'
          })
        ).rejects.toThrow(BusinessException);
      }
    });
  });

  describe('logging and tracing', () => {
    it('should log webhook processing with trace ID', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      const validPayload = {
        object: 'whatsapp_business_account',
        entry: [{ id: 'test', changes: [] }]
      };

      mockWhatsappService.handleWebhook.mockResolvedValue({
        processed: true,
        message: 'Success'
      });

      await controller.handleWebhook(validPayload);

      expect(loggerSpy).toHaveBeenCalledWith(
        'WhatsApp webhook received',
        expect.objectContaining({
          traceId: 'test-trace-id'
        })
      );

      loggerSpy.mockRestore();
    });

    it('should log send message requests with masked phone numbers', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      mockWhatsappService.sendMessage.mockResolvedValue();

      await controller.sendMessage({
        to: '+1234567890',
        message: 'Test message'
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        'Manual message send request',
        expect.objectContaining({
          to: '+1234567***', // Phone number should be masked
          traceId: 'test-trace-id'
        })
      );

      loggerSpy.mockRestore();
    });
  });
});
