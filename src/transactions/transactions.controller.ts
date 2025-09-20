import { Currency } from '@common/constants/transaction-categories';
import { ApiResponseDecorator } from '@common/decorators/api-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ValidationException } from '@common/exceptions';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CreateTransactionDto, TransactionExportDto, TransactionQueryDto, TransactionResponseDto, UpdateTransactionDto } from './dto';
import { FileUploadService } from './file-upload.service';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly fileUploadService: FileUploadService
  ) {}
}
