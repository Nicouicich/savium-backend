import {Controller, Get} from '@nestjs/common';
import {ApiOperation, ApiResponse, ApiTags} from '@nestjs/swagger';
import {Public} from '@common/decorators/public.decorator';
import {AppService} from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiOperation({summary: 'Application welcome message'})
  @ApiResponse({
    status: 200,
    description: 'Welcome message',
    schema: {
      type: 'string',
      example: 'Welcome to Savium AI Backend!'
    }
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  @ApiOperation({summary: 'Health check endpoint'})
  @ApiResponse({
    status: 200,
    description: 'Application health status',
    schema: {
      properties: {
        status: {type: 'string', example: 'ok'},
        timestamp: {type: 'string', example: '2024-01-01T00:00:00.000Z'},
        uptime: {type: 'number', example: 12345.678},
        environment: {type: 'string', example: 'development'},
        version: {type: 'string', example: '1.0.0'}
      }
    }
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
