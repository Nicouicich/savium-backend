import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { TelegramService } from './telegram.service';

@ApiTags('Telegram Integration')
@Controller('integrations/telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}
}
