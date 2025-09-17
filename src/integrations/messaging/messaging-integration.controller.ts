import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessagingIntegrationService } from './messaging-integration.service';
import type { SendMessageRequest, ConnectUserRequest, MessageResult } from './messaging.types';

@ApiTags('Messaging Integration')
@Controller('integrations/messaging')
export class MessagingIntegrationController {
  constructor(private readonly messagingService: MessagingIntegrationService) {}

  @Post('send')
  @ApiOperation({
    summary: 'Send message to user via messaging platforms',
    description: 'Send a message to a user through Telegram, WhatsApp, or both platforms'
  })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  async sendMessage(@Body() body: SendMessageRequest) {
    const { userId, message, platform } = body;

    if (!userId || !message || !platform) {
      throw new Error('userId, message, and platform are required');
    }

    const result = await this.messagingService.sendMessageToUser({
      userId,
      message,
      platform
    });

    return {
      success: result.success,
      results: result.results,
      timestamp: new Date()
    };
  }

  @Post('connect')
  @ApiOperation({
    summary: 'Connect user to messaging platform',
    description: 'Associate a user with their Telegram chat ID or WhatsApp phone number'
  })
  @ApiResponse({ status: 200, description: 'User connected successfully' })
  async connectUser(@Body() body: ConnectUserRequest) {
    const { userId, platform, chatId, phoneNumber, additionalData } = body;

    if (!userId || !platform) {
      throw new Error('userId and platform are required');
    }

    if (platform === 'telegram' && !chatId) {
      throw new Error('chatId is required for Telegram integration');
    }

    if (platform === 'whatsapp' && !phoneNumber) {
      throw new Error('phoneNumber is required for WhatsApp integration');
    }

    const success = await this.messagingService.connectUserToMessaging({
      userId,
      platform,
      chatId,
      phoneNumber,
      additionalData
    });

    return {
      success,
      message: success ? 'User connected successfully' : 'Failed to connect user',
      platform,
      timestamp: new Date()
    };
  }

  @Get('status/:userId')
  @ApiOperation({
    summary: 'Get user messaging integration status',
    description: "Get the current status of a user's messaging platform connections"
  })
  @ApiResponse({ status: 200, description: 'User messaging status retrieved' })
  async getUserStatus(@Param('userId') userId: string) {
    const status = await this.messagingService.getUserMessagingStatus(userId);
    return {
      ...status,
      timestamp: new Date()
    };
  }

  @Get('user/telegram/:chatId')
  @ApiOperation({
    summary: 'Find user by Telegram chat ID',
    description: 'Find a user associated with a specific Telegram chat ID'
  })
  @ApiResponse({ status: 200, description: 'User found' })
  async findUserByTelegramChatId(@Param('chatId') chatId: string) {
    const user = await this.messagingService.findUserByChatId(chatId);

    if (!user) {
      return {
        found: false,
        message: 'No user found for this Telegram chat ID',
        chatId
      };
    }

    return {
      found: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      },
      telegram: user.messagingIntegrations?.telegram,
      chatId
    };
  }

  @Get('user/whatsapp/:phoneNumber')
  @ApiOperation({
    summary: 'Find user by WhatsApp phone number',
    description: 'Find a user associated with a specific WhatsApp phone number'
  })
  @ApiResponse({ status: 200, description: 'User found' })
  async findUserByWhatsAppPhone(@Param('phoneNumber') phoneNumber: string) {
    const user = await this.messagingService.findUserByPhoneNumber(phoneNumber);

    if (!user) {
      return {
        found: false,
        message: 'No user found for this WhatsApp phone number',
        phoneNumber
      };
    }

    return {
      found: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      },
      whatsapp: user.messagingIntegrations?.whatsapp,
      phoneNumber
    };
  }
}
