import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';

@ApiTags('WhatsApp Integration')
@Controller('integrations/whatsapp')
export class WhatsappController {
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
  @ApiOperation({
    summary: 'Verify WhatsApp webhook',
    description: 'Webhook verification endpoint for WhatsApp Business API'
  })
  @ApiQuery({
    name: 'hub.mode',
    required: true,
    description: 'Verification mode'
  })
  @ApiQuery({
    name: 'hub.verify_token',
    required: true,
    description: 'Verification token'
  })
  @ApiQuery({
    name: 'hub.challenge',
    required: true,
    description: 'Challenge string'
  })
  @ApiResponse({ status: 200, description: 'Webhook verified successfully' })
  @ApiResponse({ status: 403, description: 'Webhook verification failed' })
  async verifyWebhook(@Query('hub.mode') mode: string, @Query('hub.verify_token') verifyToken: string, @Query('hub.challenge') challenge: string) {
    const result = this.whatsappService.verifyWebhook(mode, verifyToken, challenge);

    if (result) {
      return result;
    }

    throw new Error('Webhook verification failed');
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle WhatsApp webhook',
    description: 'Process incoming WhatsApp messages and media (structure only - not implemented)'
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Body() payload: any) {
    try {
      const result = await this.whatsappService.handleWebhook(payload);
      return result;
    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      return {
        processed: false,
        message: 'Error processing webhook',
        error: error.message
      };
    }
  }

  @Post('send')
  @ApiOperation({
    summary: 'Send WhatsApp message',
    description: 'Send a message via WhatsApp Business API (structure only - not implemented)'
  })
  @ApiResponse({ status: 200, description: 'Message sent successfully (mock)' })
  async sendMessage(@Body() body: { to: string; message: string }) {
    const { to, message } = body;

    if (!to || !message) {
      throw new Error('Phone number and message are required');
    }

    await this.whatsappService.sendMessage(to, message);

    return {
      success: true,
      message: 'Message sent (mock implementation)',
      to,
      timestamp: new Date()
    };
  }
}
