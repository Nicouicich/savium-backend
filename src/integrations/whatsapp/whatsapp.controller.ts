import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { WhatsappService } from './whatsapp.service';
import { RequestContextService } from '@common/interceptors/request-context';
import { BusinessException } from '@common/exceptions/business.exception';
import { ErrorCode } from '@common/constants/error-codes';

@ApiTags('WhatsApp Integration')
@Controller('integrations/whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get WhatsApp integration status',
    description: 'Get current WhatsApp integration status and available features'
  })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp service status retrieved'
  })
  async getStatus() {
    return this.whatsappService.getServiceStatus();
  }

  @Get('webhook')
  @Public()
  @ApiOperation({
    summary: 'Verify WhatsApp webhook',
    description: 'Webhook verification endpoint for WhatsApp Business API'
  })
  @ApiQuery({
    name: 'hub.mode',
    required: false,
    description: 'Verification mode'
  })
  @ApiQuery({
    name: 'hub.verify_token',
    required: false,
    description: 'Verification token'
  })
  @ApiQuery({
    name: 'hub.challenge',
    required: false,
    description: 'Challenge string'
  })
  @ApiResponse({ status: 200, description: 'Webhook verified successfully' })
  @ApiResponse({ status: 403, description: 'Webhook verification failed' })
  async verifyWebhook(@Query('hub.mode') mode?: string, @Query('hub.verify_token') verifyToken?: string, @Query('hub.challenge') challenge?: string) {
    // If no parameters provided, return a simple OK response for Facebook's initial check
    if (!mode && !verifyToken && !challenge) {
      return {
        status: 'ok',
        message: 'WhatsApp webhook endpoint is ready',
        timestamp: new Date().toISOString()
      };
    }

    // If verification parameters are provided, perform verification
    if (mode && verifyToken && challenge) {
      const result = this.whatsappService.verifyWebhook(mode, verifyToken, challenge);

      if (result) {
        // Return the challenge directly for Facebook verification
        return result;
      }

      throw new Error('Webhook verification failed');
    }

    // If partial parameters provided, return error
    throw new Error('Invalid webhook verification request');
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle WhatsApp webhook',
    description: 'Process incoming WhatsApp messages and media with full AI integration and expense tracking'
  })
  @ApiBody({
    description: 'WhatsApp webhook payload',
    schema: {
      type: 'object',
      properties: {
        object: { type: 'string' },
        entry: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              changes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    value: {
                      type: 'object',
                      properties: {
                        messaging_product: { type: 'string' },
                        metadata: { type: 'object' },
                        contacts: { type: 'array' },
                        messages: { type: 'array' },
                        statuses: { type: 'array' }
                      }
                    },
                    field: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'boolean' },
        message: { type: 'string' },
        timestamp: { type: 'string' },
        traceId: { type: 'string' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook payload'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error processing webhook'
  })
  async handleWebhook(@Body() payload: any) {
    const traceId = RequestContextService.getTraceId() || `webhook_${Date.now()}`;

    try {
      this.logger.log('WhatsApp webhook received', {
        hasPayload: !!payload,
        objectType: payload?.object,
        entryCount: payload?.entry?.length || 0,
        traceId
      });

      // Validate payload structure
      if (!payload || !payload.entry || !Array.isArray(payload.entry)) {
        this.logger.warn('Invalid webhook payload structure', {
          payload: JSON.stringify(payload).substring(0, 500),
          traceId
        });

        return {
          processed: false,
          message: 'Invalid webhook payload structure',
          timestamp: new Date().toISOString(),
          traceId
        };
      }

      const result = await this.whatsappService.handleWebhook(payload);

      this.logger.log('WhatsApp webhook processed successfully', {
        processed: result.processed,
        traceId
      });

      return {
        ...result,
        timestamp: new Date().toISOString(),
        traceId
      };
    } catch (error) {
      this.logger.error('WhatsApp webhook processing failed', {
        error: error.message,
        stack: error.stack,
        payload: JSON.stringify(payload).substring(0, 500),
        traceId
      });

      // Return success to WhatsApp to avoid retries for application errors
      return {
        processed: false,
        message: 'Webhook processing failed',
        error: error.message,
        timestamp: new Date().toISOString(),
        traceId
      };
    }
  }

  @Post('send')
  @ApiOperation({
    summary: 'Send WhatsApp message',
    description: 'Send a message via WhatsApp Business API with full integration'
  })
  @ApiBody({
    description: 'Send message request',
    schema: {
      type: 'object',
      required: ['to', 'message'],
      properties: {
        to: {
          type: 'string',
          description: 'Phone number in international format (e.g., +1234567890)',
          example: '+1234567890'
        },
        message: {
          type: 'string',
          description: 'Message text to send',
          example: 'Hello! This is a test message from Savium.'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        to: { type: 'string' },
        timestamp: { type: 'string' },
        traceId: { type: 'string' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters'
  })
  async sendMessage(@Body() body: { to: string; message: string }) {
    const traceId = RequestContextService.getTraceId() || `send_${Date.now()}`;
    const { to, message } = body;

    this.logger.log('Manual message send request', {
      to: to?.substring(0, 8) + '***', // Mask phone number for privacy
      messageLength: message?.length || 0,
      traceId
    });

    // Validate input
    if (!to || !message) {
      throw new BusinessException('Phone number and message are required', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
    }

    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to)) {
      throw new BusinessException('Invalid phone number format. Use international format with + prefix.', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
    }

    try {
      await this.whatsappService.sendMessage(to, message);

      this.logger.log('Message sent successfully', {
        to: to.substring(0, 8) + '***',
        traceId
      });

      return {
        success: true,
        message: 'Message sent successfully',
        to,
        timestamp: new Date().toISOString(),
        traceId
      };
    } catch (error) {
      this.logger.error('Failed to send message', {
        error: error.message,
        to: to.substring(0, 8) + '***',
        traceId
      });

      throw new BusinessException('Failed to send WhatsApp message', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.EXTERNAL_SERVICE_ERROR);
    }
  }
}
