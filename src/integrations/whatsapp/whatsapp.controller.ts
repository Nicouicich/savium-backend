import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
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
