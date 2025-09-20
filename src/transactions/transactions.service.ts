import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ClientSession } from 'mongoose';
import { TransactionStats, TransactionsRepository, PaginatedResult } from './transactions.repository';
import { CreateTransactionDto, TransactionQueryDto, UpdateTransactionDto, TransactionExportDto, ExportPeriod } from './dto';
import { TransactionDocument } from './schemas/transaction.schema';
import { ProfilesService } from '../profiles/profiles.service';
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
    private readonly profilesService: ProfilesService,
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

  /*   async createWithTransaction(createTransactionDto: CreateTransactionDto, userId: string, session: ClientSession): Promise<TransactionDocument> {
      const profile = await this.validateProfileAccess(createTransactionDto.profileId, userId);
  
      // Verify category exists
      const category = await this.categoriesService.findById(createTransactionDto.categoryId);
      if (!category) {
        throw new NotFoundException('Category not found');
      }
  
      // Validate payment method and card if provided
      await this.validatePaymentMethodAndCard(createTransactionDto, userId);
  
      // Default currency to profile currency if not provided
      if (!createTransactionDto.currency) {
        createTransactionDto.currency = profile.currency as Currency;
        this.logger.log(`Defaulting transaction currency to profile currency: ${profile.currency}`);
      }
  
      // Process recurring pattern if provided
      if (createTransactionDto.isRecurring && createTransactionDto.recurringPattern) {
        createTransactionDto.recurringPattern.nextOccurrence = this.calculateNextOccurrence(
          createTransactionDto.date,
          createTransactionDto.recurringPattern.frequency,
          createTransactionDto.recurringPattern.interval
        );
      }
  
      // Process split details if provided
      if (createTransactionDto.isSharedTransaction && createTransactionDto.splitDetails) {
        this.validateSplitDetails(createTransactionDto.splitDetails, createTransactionDto.amount);
      }
  
      // Set metadata
      const metadata = {
        source: 'manual',
        tags: createTransactionDto.tags || [],
        location: createTransactionDto.location,
        additional: createTransactionDto.metadata || {}
      };
  
      const transactionData = {
        ...createTransactionDto,
        metadata
      };
  
      return this.transactionsRepository.createWithSession(transactionData, userId, session);
    } */

  /*   async createWithFiles(createTransactionDto: CreateTransactionDto, files: Express.Multer.File[], userId: string): Promise<TransactionDocument> {
      this.fileUploadService.validateFileUpload(files);
      const processedFiles = this.fileUploadService.processUploadedFiles(files);
  
      const transactionWithFiles = {
        ...createTransactionDto,
        attachedFiles: processedFiles,
        metadata: {
          ...createTransactionDto.metadata,
          source: 'file_upload'
        }
      };
  
      this.logger.log(`Creating transaction with ${files.length} file(s) for user ${userId}`);
      return this.create(transactionWithFiles, userId);
    } */

  private async validateProfileAccess(profileId: string, userId: string): Promise<any> {
    const profile = await this.profilesService.findById(profileId);
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${profileId} not found`);
    }

    // Check if user owns the profile
    if (profile.userId.toString() !== userId) {
      throw new UnauthorizedAccessException('access profile', profileId);
    }

    return profile;
  }

  /*  async findAll(query: TransactionQueryDto, userId?: string): Promise<PaginatedResult<TransactionDocument>> {
     // If userId is provided, filter by user's accessible profiles
     if (userId && !query.profileId) {
       const userProfiles = await this.profilesService.findByUserId(userId);
       const profileIds = userProfiles.map(profile => profile.id);
 
       if (profileIds.length === 0) {
         return {
           data: [],
           total: 0,
           page: query.page || 1,
           limit: query.limit || 20,
           totalPages: 0,
           hasNextPage: false,
           hasPrevPage: false
         };
       }
 
       // Add profile filter if not specified
       query.profileId = profileIds[0]; // Default to first profile, or modify to search across all
     }
 
     // Use optimized aggregation pipeline for better performance
     return this.transactionsRepository.findManyOptimized(query);
   } */

  async findOne(id: string, userId?: string): Promise<TransactionDocument> {
    const transaction = await this.transactionsRepository.findById(id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Check if user has access to this transaction's account
    if (userId) {
      await this.validateProfileAccess(transaction.profileId.toString(), userId);

      // Check if transaction is private and user is not the owner
     /*  if (transaction.isPrivate && transaction.userId.toString() !== userId) {
        throw new ForbiddenException('This transaction is private');
      } */
    }

    return transaction;
  }

  async remove(id: string, userId: string): Promise<void> {
    const transaction = await this.findOne(id, userId);

    /* // Check if user can delete this transaction
    const canDelete = await this.canUserDeleteTransaction(transaction, userId);
    if (!canDelete) {
      throw new ForbiddenException('You cannot delete this transaction');
    } */

    await this.transactionsRepository.softDelete(id, userId);
  }

  /* 
    async findByProfile(
      profileId: string,
      options: {
        page?: number;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      } = {},
      userId?: string
    ): Promise<PaginatedResult<TransactionDocument>> {
      // Verify user has access to profile
      if (userId) {
        const profile = await this.profilesService.findOne(profileId, userId);
        if (!profile) {
          throw new ForbiddenException('Access denied to this profile');
        }
      }
  
      return this.transactionsRepository.findByProfile(profileId, options);
    } */

  async findByCategory(categoryId: string, profileId?: string, userId?: string, limit = 100): Promise<TransactionDocument[]> {
    // Verify access if profileId is provided
    if (profileId && userId) {
      const profile = await this.profilesService.findOne(profileId, userId);
      if (!profile) {
        throw new ForbiddenException('Access denied to this profile');
      }
    }

    return this.transactionsRepository.findByCategory(categoryId, profileId, limit);
  }

  async getTransactionStats(profileId?: string, userId?: string, startDate?: Date, endDate?: Date, currency?: Currency): Promise<TransactionStats> {
    // Verify access if profileId is provided
    if (profileId && userId) {
      const profile = await this.profilesService.findOne(profileId, userId);
      if (!profile) {
        throw new ForbiddenException('Access denied to this profile');
      }
    }

    return this.transactionsRepository.getTransactionStats(profileId, userId, startDate, endDate, currency);
  }

  async getCategoryBreakdown(
    profileId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<{
      categoryId: string;
      categoryName: string;
      categoryIcon: string;
      categoryColor: string;
      totalAmount: number;
      transactionCount: number;
      percentage: number;
    }>
  > {
    // Verify user has access to profile
    const profile = await this.profilesService.findOne(profileId, userId);
    if (!profile) {
      throw new ForbiddenException('Access denied to this profile');
    }

    return this.transactionsRepository.getCategoryBreakdown(profileId, startDate, endDate);
  }

  async getMonthlyTrends(
    profileId: string,
    userId: string,
    months = 12
  ): Promise<
    Array<{
      year: number;
      month: number;
      totalAmount: number;
      transactionCount: number;
      averageAmount: number;
    }>
  > {
    // Verify user has access to profile
    const profile = await this.profilesService.findOne(profileId, userId);
    if (!profile) {
      throw new ForbiddenException('Access denied to this profile');
    }

    return this.transactionsRepository.getMonthlyTrends(profileId, months);
  }

  /* async processRecurringTransactions(systemApiKey?: string, adminUserId?: string): Promise<void> {
    // Validate authorization for this critical system operation
    const systemKey = this.configService.get<string>('app.systemApiKey');
    const isValidSystemKey = systemApiKey && systemKey && systemApiKey === systemKey;

    if (!isValidSystemKey && !adminUserId) {
      this.logger.error('Unauthorized access attempt to processRecurringTransactions', {
        hasSystemKey: !!systemApiKey,
        hasAdminUserId: !!adminUserId,
        timestamp: new Date().toISOString()
      });
      throw new ForbiddenException('Unauthorized: System API key or admin user ID required for processing recurring transactions');
    }

    // If admin user ID is provided, verify it's a valid admin with proper role
    if (adminUserId && !isValidSystemKey) {
      try {
        const adminUser = await this.usersService.findById(adminUserId);
        if (!adminUser) {
          this.logger.error('Invalid admin user ID provided for processRecurringTransactions', {
            adminUserId,
            timestamp: new Date().toISOString()
          });
          throw new ForbiddenException('Invalid admin user');
        }

        // Check if user has admin role or system admin permissions
        const hasAdminRole = adminUser.role === UserRole.ADMIN || adminUser.role === UserRole.SUPER_ADMIN;
        const hasSystemPermissions = adminUser.permissions?.includes('PROCESS_RECURRING_EXPENSES') || adminUser.permissions?.includes('SYSTEM_OPERATIONS');

        if (!hasAdminRole && !hasSystemPermissions) {
          this.logger.error('User lacks admin privileges for processRecurringTransactions', {
            adminUserId,
            userRole: adminUser.role,
            userPermissions: adminUser.permissions,
            timestamp: new Date().toISOString()
          });
          throw new ForbiddenException('Insufficient privileges: Admin role required');
        }

        this.logger.log('Recurring transactions processing authorized by admin user', {
          adminUserId,
          adminRole: adminUser.role,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        this.logger.error('Error validating admin user for processRecurringTransactions', {
          adminUserId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        throw new ForbiddenException('Admin user validation failed');
      }
    } else if (isValidSystemKey) {
      this.logger.log('Recurring transactions processing authorized by system API key', {
        timestamp: new Date().toISOString()
      });
    }

    // Additional security: Rate limiting for this critical operation
    const operationKey = `recurring_transactions_process:${adminUserId || 'system'}`;
    const lastProcessTime = await this.cacheService.get<number>(`last_process:${operationKey}`);
    const cooldownPeriod = 5 * 60 * 1000; // 5 minutes cooldown

    if (lastProcessTime && Date.now() - lastProcessTime < cooldownPeriod) {
      const remainingCooldown = cooldownPeriod - (Date.now() - lastProcessTime);
      this.logger.warn('Recurring transactions processing blocked by cooldown', {
        operationKey,
        remainingCooldownMs: remainingCooldown,
        timestamp: new Date().toISOString()
      });
      throw new ForbiddenException(`Operation cooldown active. Try again in ${Math.ceil(remainingCooldown / 1000)} seconds`);
    }

    // Set cooldown
    await this.cacheService.set(`last_process:${operationKey}`, Date.now(), { ttl: 600 }); // 10 minutes TTL

    this.logger.log('Starting automated recurring transactions processing', {
      authorizedBy: adminUserId ? `admin:${adminUserId}` : 'system',
      timestamp: new Date().toISOString()
    });

    // This method would be called by a scheduled task
    const recurringTransactions = await this.transactionsRepository.findRecurringTransactions('');

    let processedCount = 0;
    let errorCount = 0;

    for (const transaction of recurringTransactions) {
      const session: ClientSession = await this.connection.startSession();

      try {
        await session.withTransaction(async () => {
          // Create a new transaction based on the recurring pattern
          const newTransactionData: CreateTransactionDto = {
            description: transaction.description,
            amount: transaction.amount,
            currency: transaction.currency,
            date: transaction.recurringPattern!.nextOccurrence!,
            categoryId: transaction.categoryId.toString(),
            profileId: transaction.profileId.toString(),
            paymentMethod: transaction.paymentMethod,
            vendor: transaction.vendor,
            notes: transaction.notes,
            isRecurring: false, // The new transaction is not recurring itself
            metadata: {
              source: 'recurring',
              originalTransactionId: (transaction as any)._id.toString()
            }
          };

          // Create new transaction with session
          await this.createWithTransaction(newTransactionData, transaction.userId.toString(), session);

          // Update the next occurrence
          const nextOccurrence = this.calculateNextOccurrence(
            transaction.recurringPattern!.nextOccurrence!,
            transaction.recurringPattern!.frequency,
            transaction.recurringPattern!.interval
          );

          // Update recurring transaction with session
          await this.transactionsRepository.updateRecurringTransactionWithSession((transaction as any)._id.toString(), nextOccurrence, session);
        });

        processedCount++;
        this.logger.debug(`Successfully processed recurring transaction ${transaction._id}`);
      } catch (error) {
        errorCount++;
        this.logger.error(`Error processing recurring transaction ${transaction._id}:`, {
          transactionId: transaction._id,
          error: error.message,
          stack: error.stack
        });
      } finally {
        await session.endSession();
      }
    }

    // Comprehensive audit logging for critical operation
    const auditLog = {
      operation: 'processRecurringTransactions',
      authorizedBy: adminUserId ? `admin:${adminUserId}` : 'system',
      totalTransactions: recurringTransactions.length,
      totalProcessed: processedCount,
      errors: errorCount,
      successRate: recurringTransactions.length > 0 ? ((processedCount / recurringTransactions.length) * 100).toFixed(2) + '%' : '0%',
      timestamp: new Date().toISOString(),
      operationDuration: Date.now() - ((await this.cacheService.get<number>(`last_process:${operationKey}`)) || Date.now())
    };

    this.logger.log('Recurring transactions processing completed', auditLog);

    // Store operation result for audit trail
    await this.cacheService.set(`audit:recurring_process:${Date.now()}`, auditLog, {
      ttl: 86400 * 30, // 30 days retention
      namespace: 'audit',
      tags: ['recurring_transactions', 'critical_operations']
    });

    // Alert if error rate is high
    if (errorCount > 0 && recurringTransactions.length > 0) {
      const errorRate = (errorCount / recurringTransactions.length) * 100;
      if (errorRate > 10) {
        // More than 10% error rate
        this.logger.error('High error rate in recurring transactions processing', {
          errorRate: errorRate.toFixed(2) + '%',
          totalErrors: errorCount,
          totalTransactions: recurringTransactions.length,
          authorizedBy: adminUserId ? `admin:${adminUserId}` : 'system'
        });
      }
    }
  } */

  async searchTransactions(searchTerm: string, profileId?: string, userId?: string, limit = 50): Promise<TransactionDocument[]> {
    // Verify access if profileId is provided
    if (profileId && userId) {
      const profile = await this.profilesService.findOne(profileId, userId);
      if (!profile) {
        throw new ForbiddenException('Access denied to this profile');
      }
    }

    return this.transactionsRepository.searchTransactions(searchTerm, profileId, limit);
  }

  async markAsReviewed(transactionId: string, userId: string, approved = true): Promise<TransactionDocument> {
    const transaction = await this.findOne(transactionId, userId);

    // Check if user can review this transaction (account admin or owner)
    const canReview = await this.canUserReviewTransaction(transaction, userId);
    if (!canReview) {
      throw new ForbiddenException('You cannot review this transaction');
    }

    const reviewedTransaction = await this.transactionsRepository.markAsReviewed(transactionId, userId, approved);

    if (!reviewedTransaction) {
      throw new NotFoundException('Transaction not found');
    }

    return reviewedTransaction;
  }

  async findTransactionsNeedingReview(profileId: string, userId: string): Promise<TransactionDocument[]> {
    // Verify user has access to profile and is admin
    const profile = await this.profilesService.findOne(profileId, userId);
    if (!profile) {
      throw new ForbiddenException('Access denied to this profile');
    }

    // For profiles, check if user has admin privileges (owner or admin role)
    if (profile.userId.toString() !== userId) {
      throw new ForbiddenException('Only profile owners can view transactions needing review');
    }

    return this.transactionsRepository.findTransactionsNeedingReview(profileId);
  }

  private calculateNextOccurrence(currentDate: Date, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly', interval: number): Date {
    const nextDate = new Date(currentDate);

    switch (frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + interval);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + interval * 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + interval);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + interval);
        break;
    }

    return nextDate;
  }

  private validateSplitDetails(splitDetails: any, totalAmount: number): void {
    if (!splitDetails.splits || splitDetails.splits.length === 0) {
      throw new BadRequestException('Split details must include at least one split');
    }

    let calculatedTotal = 0;

    switch (splitDetails.splitMethod) {
      case 'equal':
        const equalAmount = totalAmount / splitDetails.splits.length;
        splitDetails.splits.forEach((split: any) => {
          split.amount = Math.round(equalAmount * 100) / 100;
          calculatedTotal += split.amount;
        });
        break;

      case 'percentage':
        let totalPercentage = 0;
        splitDetails.splits.forEach((split: any) => {
          if (!split.percentage) {
            throw new BadRequestException('Percentage is required for percentage split method');
          }
          totalPercentage += split.percentage;
          split.amount = Math.round(((totalAmount * split.percentage) / 100) * 100) / 100;
          calculatedTotal += split.amount;
        });

        if (Math.abs(totalPercentage - 100) > 0.01) {
          throw new BadRequestException('Total percentage must equal 100%');
        }
        break;

      case 'amount':
        splitDetails.splits.forEach((split: any) => {
          if (!split.amount) {
            throw new BadRequestException('Amount is required for amount split method');
          }
          calculatedTotal += split.amount;
        });
        break;
    }

    // Allow small rounding differences
    if (Math.abs(calculatedTotal - totalAmount) > 0.02) {
      throw new BadRequestException('Split amounts do not match total transaction amount');
    }
  }

 /*  private async canUserEditTransaction(transaction: TransactionDocument, userId: string): Promise<boolean> {
    // User is the owner
    if (transaction.userId.toString() === userId) {
      return true;
    }

    // User is an admin of the account
    // For profiles, the owner is the only admin
    const profile = await this.profilesService.findById(transaction.profileId.toString());
    const isAdmin = profile && profile.userId.toString() === userId;
    return Boolean(isAdmin);
  } */

/*   private async canUserDeleteTransaction(transaction: TransactionDocument, userId: string): Promise<boolean> {
    // Same logic as edit for now, could be different in future
    return this.canUserEditTransaction(transaction, userId);
  } */

  private async canUserReviewTransaction(transaction: TransactionDocument, userId: string): Promise<boolean> {
    // User cannot review their own transaction
  /*   if (transaction.userId.toString() === userId) {
      return false;
    } */

    // User must be an admin of the account
    // For profiles, the owner is the only admin
    const profile = await this.profilesService.findById(transaction.profileId.toString());
    const isAdmin = profile && profile.userId.toString() === userId;
    return Boolean(isAdmin);
  }

  /*   async exportTransactions(exportDto: TransactionExportDto, userId: string): Promise<Buffer> {
      this.logger.log(`Starting transaction export for user ${userId} with format ${exportDto.format}`);
  
      // Validate profile access
      let profileId = exportDto.profileId;
      if (!profileId) {
        // Get user's default profile if not specified
        const userProfiles = await this.profilesService.findByUserId(userId);
        if (userProfiles.length === 0) {
          throw new BadRequestException('No profiles found for user');
        }
        profileId = userProfiles[0].id;
      }
  
      if (!profileId) {
        throw new BadRequestException('Profile ID is required');
      }
  
      // Get and validate profile access
      const profile = await this.validateProfileAccess(profileId, userId);
  
      // Calculate date range based on period
      const dateRange = this.pdfExportService.calculateDateRange(exportDto.period || ExportPeriod.CURRENT_MONTH, exportDto.startDate, exportDto.endDate);
  
      // Build query for transactions
      const query: any = {
        profileId: profileId,
        startDate: dateRange.start,
        endDate: dateRange.end,
        limit: 10000, // Large limit for export
        page: 1
      };
  
      // Add category filter if specified
      if (exportDto.categoryId) {
        query.categoryId = exportDto.categoryId;
      }
  
      // Filter private transactions if user doesn't want them included
      if (!exportDto.includePrivate) {
        query.isPrivate = false;
      }
  
      // Get transactions data
      const transactionsResult = await this.transactionsRepository.findManyOptimized(query);
  
      // Get additional data for PDF
      const [stats, categoryBreakdown, monthlyTrends] = await Promise.all([
        this.getTransactionStats(profileId, userId, dateRange.start, dateRange.end),
        exportDto.includeCategoryBreakdown ? this.getCategoryBreakdown(profileId, userId, dateRange.start, dateRange.end) : Promise.resolve(undefined),
        exportDto.includeMonthlyTrends ? this.getMonthlyTrends(profileId, userId, 6) : Promise.resolve(undefined)
      ]);
  
      // Prepare export data
      const exportData = {
        transactions: transactionsResult.data,
        summary: {
          totalAmount: stats.totalAmount || 0,
          totalTransactions: stats.totalTransactions || 0,
          averageAmount: stats.averageAmount || 0,
          currency: profile.currency || Currency.USD,
          period: exportDto.period || ExportPeriod.CURRENT_MONTH,
          dateRange: dateRange.description
        },
        categoryBreakdown,
        monthlyTrends,
        profileInfo: {
          id: profile._id.toString(),
          name: profile.name || 'Mi Perfil',
          type: profile.type || 'personal'
        }
      };
  
      // Generate PDF based on format
      switch (exportDto.format) {
        case 'pdf':
          return this.pdfExportService.generateTransactionsPdf(exportData, exportDto);
  
        case 'csv':
          // TODO: Implement CSV export
          throw new BadRequestException('CSV export not yet implemented');
  
        case 'excel':
          // TODO: Implement Excel export
          throw new BadRequestException('Excel export not yet implemented');
  
        default:
          throw new BadRequestException('Unsupported export format');
      }
    } */

  /**
   * Validate payment method and card for transaction creation/update
   */
  private async validatePaymentMethodAndCard(transactionDto: any, userId: string): Promise<void> {
    // Validate payment method if provided
    if (transactionDto.paymentMethodId) {
      const paymentMethod = await this.paymentMethodsService.findById(transactionDto.paymentMethodId);

      // Check if payment method requires a card
      if (paymentMethod.requiresCard && !transactionDto.cardId) {
        throw new ValidationException('Card is required for this payment method');
      }
    }

    // Validate card if provided
    if (transactionDto.cardId) {
      try {
        const card = await this.cardsService.findCardById(transactionDto.cardId, userId);

        // Check if card is active and usable
        if (card.status !== 'ACTIVE') {
          throw new ValidationException('Card is not active');
        }

        // Update card balance if this is a debit transaction
        // This will be implemented when we have the card balance service
      } catch (error) {
        if (error instanceof ValidationException) {
          throw error;
        }
        throw new ValidationException('Invalid card ID or card not accessible');
      }
    }
  }
}
