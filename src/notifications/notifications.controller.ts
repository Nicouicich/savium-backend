import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get notifications service status',
    description: 'Get current notifications integration status and available channels'
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications service status retrieved'
  })
  async getStatus() {
    return this.notificationsService.getServiceStatus();
  }

  @Post('send')
  @ApiOperation({
    summary: 'Send custom notification',
    description: 'Send a custom notification to user (structure only - not implemented)'
  })
  @ApiResponse({
    status: 200,
    description: 'Notification sent successfully (mock)'
  })
  async sendNotification(
    @Body()
    body: {
      title: string;
      message: string;
      type?: 'info' | 'success' | 'warning' | 'error';
      channels?: string[];
    },
    @CurrentUser() user: any
  ) {
    const result = await this.notificationsService.sendNotification({
      userId: user.id,
      title: body.title,
      message: body.message,
      type: body.type || 'info',
      channels: body.channels as any
    });

    return {
      ...result,
      message: 'Notification sent (mock implementation)',
      timestamp: new Date()
    };
  }

  @Post('test-budget-alert')
  @ApiOperation({
    summary: 'Test budget alert notification',
    description: 'Send a test budget alert notification (mock)'
  })
  @ApiResponse({ status: 200, description: 'Test budget alert sent' })
  async testBudgetAlert(@CurrentUser() user: any) {
    await this.notificationsService.sendBudgetAlert(user.id, 'Monthly Budget', 850, 1000);

    return {
      success: true,
      message: 'Test budget alert sent (mock)',
      timestamp: new Date()
    };
  }

  @Post('test-goal-reminder')
  @ApiOperation({
    summary: 'Test goal reminder notification',
    description: 'Send a test goal reminder notification (mock)'
  })
  @ApiResponse({ status: 200, description: 'Test goal reminder sent' })
  async testGoalReminder(@CurrentUser() user: any) {
    await this.notificationsService.sendGoalReminder(user.id, 'Emergency Fund', 2500, 45);

    return {
      success: true,
      message: 'Test goal reminder sent (mock)',
      timestamp: new Date()
    };
  }
}
