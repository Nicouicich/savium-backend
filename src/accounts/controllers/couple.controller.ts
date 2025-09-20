import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, Request, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';

import { CoupleService } from '../services/couple.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import {
  UpdateCoupleSettingsDto,
  CoupleSettingsResponseDto,
  AcceptCoupleInvitationDto,
  CoupleStatsDto,
  TransactionContextParseDto
} from '../dto/couple-settings.dto';

import { CoupleReactionType } from '@common/constants/couple-types';

@ApiTags('Couple Management')
@Controller('couples')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CoupleController {
  constructor(private readonly coupleService: CoupleService) {}
}
