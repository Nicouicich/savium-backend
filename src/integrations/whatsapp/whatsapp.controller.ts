import { ErrorCode } from '@common/constants/error-codes';
import { Public } from '@common/decorators/public.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { RequestContextService } from '@common/interceptors/request-context';
import { LogFormatter } from '@common/utils/log-formatter';
import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SendMessageDto, SendMessageResponseDto, WhatsAppChangeDto, WhatsAppWebhookDto } from './dto';
import { WhatsappService } from './whatsapp.service';

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
    description: 'Process incoming WhatsApp messages and media with full AI integration and transaction tracking'
  })
  @ApiBody({
    description: 'WhatsApp webhook payload',
    type: WhatsAppWebhookDto
  })
  async handleWebhook(@Body() payload: WhatsAppWebhookDto) {
    const traceId = RequestContextService.getTraceId() || `webhook_${Date.now()}`;

    this.logger.log(
      LogFormatter.webhook('WhatsApp webhook received', {
        hasPayload: !!payload,
        objectType: payload?.object,
        entryCount: payload?.entry?.length || 0,
        traceId
      })
    );

    await this.whatsappService.handleWebhook(payload);
  }

  @Post('send')
  @ApiOperation({
    summary: 'Send WhatsApp message',
    description: 'Send a message via WhatsApp Business API with full integration'
  })
  @ApiBody({
    description: 'Send message request',
    type: SendMessageDto
  })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
    type: SendMessageResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters'
  })
  async sendMessage(@Body() body: SendMessageDto) {
    const traceId = RequestContextService.getTraceId() || `send_${Date.now()}`;
    const { to, message } = body;

    this.logger.log('Manual message send request', {
      to: to?.substring(0, 8) + '***', // Mask phone number for privacy
      messageLength: message?.length || 0,
      traceId
    });

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
