import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessagingIntegrationService } from './messaging-integration.service';
import type { SendMessageRequest, ConnectUserRequest, MessageResult } from './messaging.types';

@ApiTags('Messaging Integration')
@Controller('integrations/messaging')
export class MessagingIntegrationController {
  constructor(private readonly messagingService: MessagingIntegrationService) {}
}
