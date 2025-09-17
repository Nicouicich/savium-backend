import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { AppService } from './app.service';
import { WhatsappService } from './integrations/whatsapp/whatsapp.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly whatsappService: WhatsappService
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Application welcome message or WhatsApp webhook verification' })
  @ApiQuery({ name: 'hub.mode', required: false, description: 'WhatsApp verification mode' })
  @ApiQuery({ name: 'hub.verify_token', required: false, description: 'WhatsApp verification token' })
  @ApiQuery({ name: 'hub.challenge', required: false, description: 'WhatsApp challenge string' })
  @ApiResponse({
    status: 200,
    description: 'Welcome message or webhook verification response',
    schema: {
      oneOf: [
        { type: 'string', example: 'Welcome to Savium AI Backend!' },
        { type: 'string', example: 'challenge_response_string' }
      ]
    }
  })
  getHello(@Query('hub.mode') mode?: string, @Query('hub.verify_token') verifyToken?: string, @Query('hub.challenge') challenge?: string): string {
    // Si tiene parámetros de WhatsApp, manejar verificación
    if (mode && verifyToken && challenge) {
      const result = this.whatsappService.verifyWebhook(mode, verifyToken, challenge);
      if (result) {
        return result;
      }
      throw new Error('Webhook verification failed');
    }

    // Si no, devolver mensaje normal
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Application health status',
    schema: {
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        uptime: { type: 'number', example: 12345.678 },
        environment: { type: 'string', example: 'development' },
        version: { type: 'string', example: '1.0.0' }
      }
    }
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
