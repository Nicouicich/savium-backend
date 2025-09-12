import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';

@ApiTags('Telegram Integration')
@Controller('integrations/telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get Telegram integration status',
    description: 'Get current Telegram bot integration status and available features'
  })
  @ApiResponse({
    status: 200,
    description: 'Telegram service status retrieved'
  })
  async getStatus() {
    return this.telegramService.getServiceStatus();
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Telegram webhook',
    description: 'Process incoming Telegram bot updates (structure only - not implemented)'
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Body() update: any) {
    try {
      const result = await this.telegramService.handleWebhook(update);
      return result;
    } catch (error) {
      console.error('Telegram webhook error:', error);
      return {
        processed: false,
        message: 'Error processing webhook',
        error: error.message
      };
    }
  }

  @Post('set-webhook')
  @ApiOperation({
    summary: 'Set Telegram webhook',
    description: 'Configure webhook URL for Telegram bot (structure only - not implemented)'
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook configured successfully (mock)'
  })
  async setWebhook(@Body() body: { url: string }) {
    const { url } = body;

    if (!url) {
      throw new Error('Webhook URL is required');
    }

    const result = await this.telegramService.setWebhook(url);

    return {
      ...result,
      timestamp: new Date()
    };
  }

  @Post('send')
  @ApiOperation({
    summary: 'Send Telegram message',
    description: 'Send a message via Telegram Bot API (structure only - not implemented)'
  })
  @ApiResponse({ status: 200, description: 'Message sent successfully (mock)' })
  async sendMessage(@Body() body: { chatId: number; message: string }) {
    const { chatId, message } = body;

    if (!chatId || !message) {
      throw new Error('Chat ID and message are required');
    }

    await this.telegramService.sendMessage(chatId, message);

    return {
      success: true,
      message: 'Message sent (mock implementation)',
      chatId,
      timestamp: new Date()
    };
  }
}
