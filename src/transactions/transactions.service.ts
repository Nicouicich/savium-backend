import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ClientSession } from 'mongoose';
import { TransactionStats, TransactionsRepository, PaginatedResult } from './transactions.repository';
import { CreateTransactionDto, TransactionQueryDto, UpdateTransactionDto, TransactionExportDto, ExportPeriod } from './dto';
import { TransactionDocument } from './schemas/transaction.schema';
import { CategoriesService } from '../categories/categories.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '@common/constants/user-roles';
import { FileUploadService, UploadedFile } from './file-upload.service';
import { PdfExportService } from './pdf-export.service';
import { Currency } from '@common/constants/transaction-categories';
import { AccountNotFoundException, TransactionNotFoundException, UnauthorizedAccessException, ValidationException } from '@common/exceptions';
import { EnhancedCacheService } from '@common/services/enhanced-cache.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { CardsService } from '../cards/cards.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly usersService: UsersService,
    private readonly fileUploadService: FileUploadService,
    private readonly pdfExportService: PdfExportService,
    private readonly configService: ConfigService,
    private readonly cacheService: EnhancedCacheService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly cardsService: CardsService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  async create(createTransactionDto: CreateTransactionDto): Promise<TransactionDocument[]> {
    return await this.transactionsRepository.create(createTransactionDto);
  }

 
}
