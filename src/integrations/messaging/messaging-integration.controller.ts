import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessagingIntegrationService } from './messaging-integration.service';
import type { ConnectUserRequest, MessageResult, SendMessageRequest } from './messaging.types';

@ApiTags('Messaging Integration')
@Controller('integrations/messaging')
export class MessagingIntegrationController {
  constructor(private readonly messagingService: MessagingIntegrationService) {}
}
