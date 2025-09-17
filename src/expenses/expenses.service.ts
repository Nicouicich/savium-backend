import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ClientSession } from 'mongoose';
import { ExpenseStats, ExpensesRepository, PaginatedResult } from './expenses.repository';
import { CreateExpenseDto, ExpenseQueryDto, UpdateExpenseDto, ExpenseExportDto, ExportPeriod } from './dto';
import { ExpenseDocument } from './schemas/expense.schema';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '@common/constants/user-roles';
import { FileUploadService, UploadedFile } from './file-upload.service';
import { PdfExportService } from './pdf-export.service';
import { Currency } from '@common/constants/expense-categories';
import { AccountNotFoundException, ExpenseNotFoundException, UnauthorizedAccessException, ValidationException } from '@common/exceptions';
import { EnhancedCacheService } from '@common/services/enhanced-cache.service';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly expensesRepository: ExpensesRepository,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
    private readonly usersService: UsersService,
    private readonly fileUploadService: FileUploadService,
    private readonly pdfExportService: PdfExportService,
    private readonly configService: ConfigService,
    private readonly cacheService: EnhancedCacheService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  async create(createExpenseDto: CreateExpenseDto, userId: string): Promise<ExpenseDocument> {
    const account = await this.validateAccountAccess(createExpenseDto.accountId, userId);

    // Verify category exists
    const category = await this.categoriesService.findById(createExpenseDto.categoryId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Default currency to account currency if not provided
    if (!createExpenseDto.currency) {
      createExpenseDto.currency = account.currency as Currency;
      this.logger.log(`Defaulting expense currency to account currency: ${account.currency}`);
    }

    // Process recurring pattern if provided
    if (createExpenseDto.isRecurring && createExpenseDto.recurringPattern) {
      createExpenseDto.recurringPattern.nextOccurrence = this.calculateNextOccurrence(
        createExpenseDto.date,
        createExpenseDto.recurringPattern.frequency,
        createExpenseDto.recurringPattern.interval
      );
    }

    // Process split details if provided
    if (createExpenseDto.isSharedExpense && createExpenseDto.splitDetails) {
      this.validateSplitDetails(createExpenseDto.splitDetails, createExpenseDto.amount);
    }

    // Set metadata
    const metadata = {
      source: 'manual',
      tags: createExpenseDto.tags || [],
      location: createExpenseDto.location,
      additional: createExpenseDto.metadata || {}
    };

    const expenseData = {
      ...createExpenseDto,
      metadata
    };

    return this.expensesRepository.create(expenseData, userId);
  }

  async createWithTransaction(createExpenseDto: CreateExpenseDto, userId: string, session: ClientSession): Promise<ExpenseDocument> {
    const account = await this.validateAccountAccess(createExpenseDto.accountId, userId);

    // Verify category exists
    const category = await this.categoriesService.findById(createExpenseDto.categoryId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Default currency to account currency if not provided
    if (!createExpenseDto.currency) {
      createExpenseDto.currency = account.currency as Currency;
      this.logger.log(`Defaulting expense currency to account currency: ${account.currency}`);
    }

    // Process recurring pattern if provided
    if (createExpenseDto.isRecurring && createExpenseDto.recurringPattern) {
      createExpenseDto.recurringPattern.nextOccurrence = this.calculateNextOccurrence(
        createExpenseDto.date,
        createExpenseDto.recurringPattern.frequency,
        createExpenseDto.recurringPattern.interval
      );
    }

    // Process split details if provided
    if (createExpenseDto.isSharedExpense && createExpenseDto.splitDetails) {
      this.validateSplitDetails(createExpenseDto.splitDetails, createExpenseDto.amount);
    }

    // Set metadata
    const metadata = {
      source: 'manual',
      tags: createExpenseDto.tags || [],
      location: createExpenseDto.location,
      additional: createExpenseDto.metadata || {}
    };

    const expenseData = {
      ...createExpenseDto,
      metadata
    };

    return this.expensesRepository.createWithSession(expenseData, userId, session);
  }

  async createWithFiles(createExpenseDto: CreateExpenseDto, files: Express.Multer.File[], userId: string): Promise<ExpenseDocument> {
    this.fileUploadService.validateFileUpload(files);
    const processedFiles = this.fileUploadService.processUploadedFiles(files);

    const expenseWithFiles = {
      ...createExpenseDto,
      attachedFiles: processedFiles,
      metadata: {
        ...createExpenseDto.metadata,
        source: 'file_upload'
      }
    };

    this.logger.log(`Creating expense with ${files.length} file(s) for user ${userId}`);
    return this.create(expenseWithFiles, userId);
  }

  private async validateAccountAccess(accountId: string, userId: string): Promise<any> {
    const account = await this.accountsService.findById(accountId);
    if (!account) {
      throw new AccountNotFoundException(accountId);
    }

    const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
    if (!hasAccess) {
      throw new UnauthorizedAccessException('access account', accountId);
    }

    return account;
  }

  async findAll(query: ExpenseQueryDto, userId?: string): Promise<PaginatedResult<ExpenseDocument>> {
    // If userId is provided, filter by user's accessible accounts
    if (userId && !query.accountId) {
      const userAccounts = await this.accountsService.findByUser(userId);
      const accountIds = userAccounts.map(account => account._id.toString());

      if (accountIds.length === 0) {
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

      // Add account filter if not specified
      query.accountId = accountIds[0]; // Default to first account, or modify to search across all
    }

    // Use optimized aggregation pipeline for better performance
    return this.expensesRepository.findManyOptimized(query);
  }

  async findOne(id: string, userId?: string): Promise<ExpenseDocument> {
    const expense = await this.expensesRepository.findById(id);
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    // Check if user has access to this expense's account
    if (userId) {
      const hasAccess = await this.accountsService.hasUserAccess(expense.accountId.toString(), userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this expense');
      }

      // Check if expense is private and user is not the owner
      if (expense.isPrivate && expense.userId.toString() !== userId) {
        throw new ForbiddenException('This expense is private');
      }
    }

    return expense;
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto, userId: string): Promise<ExpenseDocument> {
    const expense = await this.findOne(id, userId);

    // Check if user can edit this expense
    const canEdit = await this.canUserEditExpense(expense, userId);
    if (!canEdit) {
      throw new ForbiddenException('You cannot edit this expense');
    }

    // Verify category if being updated
    if (updateExpenseDto.categoryId) {
      const category = await this.categoriesService.findById(updateExpenseDto.categoryId);
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // Process recurring pattern updates
    if (updateExpenseDto.isRecurring !== undefined) {
      if (updateExpenseDto.isRecurring && updateExpenseDto.recurringPattern) {
        updateExpenseDto.recurringPattern.nextOccurrence = this.calculateNextOccurrence(
          updateExpenseDto.date || expense.date,
          updateExpenseDto.recurringPattern.frequency,
          updateExpenseDto.recurringPattern.interval
        );
      } else if (!updateExpenseDto.isRecurring) {
        updateExpenseDto.recurringPattern = undefined;
      }
    }

    // Process split details if being updated
    if (updateExpenseDto.splitDetails) {
      this.validateSplitDetails(updateExpenseDto.splitDetails, updateExpenseDto.amount || expense.amount);
    }

    const updatedExpense = await this.expensesRepository.update(id, updateExpenseDto);
    if (!updatedExpense) {
      throw new NotFoundException('Expense not found');
    }

    return updatedExpense;
  }

  async remove(id: string, userId: string): Promise<void> {
    const expense = await this.findOne(id, userId);

    // Check if user can delete this expense
    const canDelete = await this.canUserDeleteExpense(expense, userId);
    if (!canDelete) {
      throw new ForbiddenException('You cannot delete this expense');
    }

    await this.expensesRepository.softDelete(id, userId);
  }

  async findByAccount(
    accountId: string,
    options: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
    userId?: string
  ): Promise<PaginatedResult<ExpenseDocument>> {
    // Verify user has access to account
    if (userId) {
      const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this account');
      }
    }

    return this.expensesRepository.findByAccount(accountId, options);
  }

  async findByCategory(categoryId: string, accountId?: string, userId?: string, limit = 100): Promise<ExpenseDocument[]> {
    // Verify access if accountId is provided
    if (accountId && userId) {
      const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this account');
      }
    }

    return this.expensesRepository.findByCategory(categoryId, accountId, limit);
  }

  async getExpenseStats(accountId?: string, userId?: string, startDate?: Date, endDate?: Date, currency?: Currency): Promise<ExpenseStats> {
    // Verify access if accountId is provided
    if (accountId && userId) {
      const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this account');
      }
    }

    return this.expensesRepository.getExpenseStats(accountId, userId, startDate, endDate, currency);
  }

  async getCategoryBreakdown(
    accountId: string,
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
      expenseCount: number;
      percentage: number;
    }>
  > {
    // Verify user has access to account
    const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this account');
    }

    return this.expensesRepository.getCategoryBreakdown(accountId, startDate, endDate);
  }

  async getMonthlyTrends(
    accountId: string,
    userId: string,
    months = 12
  ): Promise<
    Array<{
      year: number;
      month: number;
      totalAmount: number;
      expenseCount: number;
      averageAmount: number;
    }>
  > {
    // Verify user has access to account
    const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this account');
    }

    return this.expensesRepository.getMonthlyTrends(accountId, months);
  }

  async processRecurringExpenses(systemApiKey?: string, adminUserId?: string): Promise<void> {
    // Validate authorization for this critical system operation
    const systemKey = this.configService.get<string>('app.systemApiKey');
    const isValidSystemKey = systemApiKey && systemKey && systemApiKey === systemKey;

    if (!isValidSystemKey && !adminUserId) {
      this.logger.error('Unauthorized access attempt to processRecurringExpenses', {
        hasSystemKey: !!systemApiKey,
        hasAdminUserId: !!adminUserId,
        timestamp: new Date().toISOString()
      });
      throw new ForbiddenException('Unauthorized: System API key or admin user ID required for processing recurring expenses');
    }

    // If admin user ID is provided, verify it's a valid admin with proper role
    if (adminUserId && !isValidSystemKey) {
      try {
        const adminUser = await this.usersService.findById(adminUserId);
        if (!adminUser) {
          this.logger.error('Invalid admin user ID provided for processRecurringExpenses', {
            adminUserId,
            timestamp: new Date().toISOString()
          });
          throw new ForbiddenException('Invalid admin user');
        }

        // Check if user has admin role or system admin permissions
        const hasAdminRole = adminUser.role === UserRole.ADMIN || adminUser.role === UserRole.SUPER_ADMIN;
        const hasSystemPermissions = adminUser.permissions?.includes('PROCESS_RECURRING_EXPENSES') || adminUser.permissions?.includes('SYSTEM_OPERATIONS');

        if (!hasAdminRole && !hasSystemPermissions) {
          this.logger.error('User lacks admin privileges for processRecurringExpenses', {
            adminUserId,
            userRole: adminUser.role,
            userPermissions: adminUser.permissions,
            timestamp: new Date().toISOString()
          });
          throw new ForbiddenException('Insufficient privileges: Admin role required');
        }

        this.logger.log('Recurring expenses processing authorized by admin user', {
          adminUserId,
          adminRole: adminUser.role,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        this.logger.error('Error validating admin user for processRecurringExpenses', {
          adminUserId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        throw new ForbiddenException('Admin user validation failed');
      }
    } else if (isValidSystemKey) {
      this.logger.log('Recurring expenses processing authorized by system API key', {
        timestamp: new Date().toISOString()
      });
    }

    // Additional security: Rate limiting for this critical operation
    const operationKey = `recurring_expenses_process:${adminUserId || 'system'}`;
    const lastProcessTime = await this.cacheService.get<number>(`last_process:${operationKey}`);
    const cooldownPeriod = 5 * 60 * 1000; // 5 minutes cooldown

    if (lastProcessTime && Date.now() - lastProcessTime < cooldownPeriod) {
      const remainingCooldown = cooldownPeriod - (Date.now() - lastProcessTime);
      this.logger.warn('Recurring expenses processing blocked by cooldown', {
        operationKey,
        remainingCooldownMs: remainingCooldown,
        timestamp: new Date().toISOString()
      });
      throw new ForbiddenException(`Operation cooldown active. Try again in ${Math.ceil(remainingCooldown / 1000)} seconds`);
    }

    // Set cooldown
    await this.cacheService.set(`last_process:${operationKey}`, Date.now(), { ttl: 600 }); // 10 minutes TTL

    this.logger.log('Starting automated recurring expenses processing', {
      authorizedBy: adminUserId ? `admin:${adminUserId}` : 'system',
      timestamp: new Date().toISOString()
    });

    // This method would be called by a scheduled task
    const recurringExpenses = await this.expensesRepository.findRecurringExpenses('');

    let processedCount = 0;
    let errorCount = 0;

    for (const expense of recurringExpenses) {
      const session: ClientSession = await this.connection.startSession();

      try {
        await session.withTransaction(async () => {
          // Create a new expense based on the recurring pattern
          const newExpenseData: CreateExpenseDto = {
            description: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            date: expense.recurringPattern!.nextOccurrence!,
            categoryId: expense.categoryId.toString(),
            accountId: expense.accountId.toString(),
            paymentMethod: expense.paymentMethod,
            vendor: expense.vendor,
            notes: expense.notes,
            isRecurring: false, // The new expense is not recurring itself
            metadata: {
              source: 'recurring',
              originalExpenseId: (expense as any)._id.toString()
            }
          };

          // Create new expense with session
          await this.createWithTransaction(newExpenseData, expense.userId.toString(), session);

          // Update the next occurrence
          const nextOccurrence = this.calculateNextOccurrence(
            expense.recurringPattern!.nextOccurrence!,
            expense.recurringPattern!.frequency,
            expense.recurringPattern!.interval
          );

          // Update recurring expense with session
          await this.expensesRepository.updateRecurringExpenseWithSession((expense as any)._id.toString(), nextOccurrence, session);
        });

        processedCount++;
        this.logger.debug(`Successfully processed recurring expense ${expense._id}`);
      } catch (error) {
        errorCount++;
        this.logger.error(`Error processing recurring expense ${expense._id}:`, {
          expenseId: expense._id,
          error: error.message,
          stack: error.stack
        });
      } finally {
        await session.endSession();
      }
    }

    // Comprehensive audit logging for critical operation
    const auditLog = {
      operation: 'processRecurringExpenses',
      authorizedBy: adminUserId ? `admin:${adminUserId}` : 'system',
      totalExpenses: recurringExpenses.length,
      totalProcessed: processedCount,
      errors: errorCount,
      successRate: recurringExpenses.length > 0 ? ((processedCount / recurringExpenses.length) * 100).toFixed(2) + '%' : '0%',
      timestamp: new Date().toISOString(),
      operationDuration: Date.now() - ((await this.cacheService.get<number>(`last_process:${operationKey}`)) || Date.now())
    };

    this.logger.log('Recurring expenses processing completed', auditLog);

    // Store operation result for audit trail
    await this.cacheService.set(`audit:recurring_process:${Date.now()}`, auditLog, {
      ttl: 86400 * 30, // 30 days retention
      namespace: 'audit',
      tags: ['recurring_expenses', 'critical_operations']
    });

    // Alert if error rate is high
    if (errorCount > 0 && recurringExpenses.length > 0) {
      const errorRate = (errorCount / recurringExpenses.length) * 100;
      if (errorRate > 10) {
        // More than 10% error rate
        this.logger.error('High error rate in recurring expenses processing', {
          errorRate: errorRate.toFixed(2) + '%',
          totalErrors: errorCount,
          totalExpenses: recurringExpenses.length,
          authorizedBy: adminUserId ? `admin:${adminUserId}` : 'system'
        });
      }
    }
  }

  async searchExpenses(searchTerm: string, accountId?: string, userId?: string, limit = 50): Promise<ExpenseDocument[]> {
    // Verify access if accountId is provided
    if (accountId && userId) {
      const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied to this account');
      }
    }

    return this.expensesRepository.searchExpenses(searchTerm, accountId, limit);
  }

  async markAsReviewed(expenseId: string, userId: string, approved = true): Promise<ExpenseDocument> {
    const expense = await this.findOne(expenseId, userId);

    // Check if user can review this expense (account admin or owner)
    const canReview = await this.canUserReviewExpense(expense, userId);
    if (!canReview) {
      throw new ForbiddenException('You cannot review this expense');
    }

    const reviewedExpense = await this.expensesRepository.markAsReviewed(expenseId, userId, approved);

    if (!reviewedExpense) {
      throw new NotFoundException('Expense not found');
    }

    return reviewedExpense;
  }

  async findExpensesNeedingReview(accountId: string, userId: string): Promise<ExpenseDocument[]> {
    // Verify user has access to account and is admin
    const hasAccess = await this.accountsService.hasUserAccess(accountId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this account');
    }

    const isAdmin = await this.accountsService.isUserAdmin(accountId, userId);
    if (!isAdmin) {
      throw new ForbiddenException('Only account administrators can view expenses needing review');
    }

    return this.expensesRepository.findExpensesNeedingReview(accountId);
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
      throw new BadRequestException('Split amounts do not match total expense amount');
    }
  }

  private async canUserEditExpense(expense: ExpenseDocument, userId: string): Promise<boolean> {
    // User is the owner
    if (expense.userId.toString() === userId) {
      return true;
    }

    // User is an admin of the account
    const isAdmin = await this.accountsService.isUserAdmin(expense.accountId.toString(), userId);
    return isAdmin;
  }

  private async canUserDeleteExpense(expense: ExpenseDocument, userId: string): Promise<boolean> {
    // Same logic as edit for now, could be different in future
    return this.canUserEditExpense(expense, userId);
  }

  private async canUserReviewExpense(expense: ExpenseDocument, userId: string): Promise<boolean> {
    // User cannot review their own expense
    if (expense.userId.toString() === userId) {
      return false;
    }

    // User must be an admin of the account
    const isAdmin = await this.accountsService.isUserAdmin(expense.accountId.toString(), userId);
    return isAdmin;
  }

  async exportExpenses(exportDto: ExpenseExportDto, userId: string): Promise<Buffer> {
    this.logger.log(`Starting expense export for user ${userId} with format ${exportDto.format}`);

    // Validate account access
    let accountId = exportDto.accountId;
    if (!accountId) {
      // Get user's default account if not specified
      const userAccounts = await this.accountsService.findByUser(userId);
      if (userAccounts.length === 0) {
        throw new BadRequestException('No accounts found for user');
      }
      accountId = userAccounts[0]._id.toString();
    }

    if (!accountId) {
      throw new BadRequestException('Account ID is required');
    }

    const account = await this.validateAccountAccess(accountId, userId);

    // Calculate date range based on period
    const dateRange = this.pdfExportService.calculateDateRange(exportDto.period || ExportPeriod.CURRENT_MONTH, exportDto.startDate, exportDto.endDate);

    // Build query for expenses
    const query: any = {
      accountId: accountId,
      startDate: dateRange.start,
      endDate: dateRange.end,
      limit: 10000, // Large limit for export
      page: 1
    };

    // Add category filter if specified
    if (exportDto.categoryId) {
      query.categoryId = exportDto.categoryId;
    }

    // Filter private expenses if user doesn't want them included
    if (!exportDto.includePrivate) {
      query.isPrivate = false;
    }

    // Get expenses data
    const expensesResult = await this.expensesRepository.findManyOptimized(query);

    // Get additional data for PDF
    const [stats, categoryBreakdown, monthlyTrends] = await Promise.all([
      this.getExpenseStats(accountId, userId, dateRange.start, dateRange.end),
      exportDto.includeCategoryBreakdown ? this.getCategoryBreakdown(accountId, userId, dateRange.start, dateRange.end) : Promise.resolve(undefined),
      exportDto.includeMonthlyTrends ? this.getMonthlyTrends(accountId, userId, 6) : Promise.resolve(undefined)
    ]);

    // Prepare export data
    const exportData = {
      expenses: expensesResult.data,
      summary: {
        totalAmount: stats.totalAmount || 0,
        totalExpenses: stats.totalExpenses || 0,
        averageAmount: stats.averageAmount || 0,
        currency: account.currency || Currency.USD,
        period: exportDto.period || ExportPeriod.CURRENT_MONTH,
        dateRange: dateRange.description
      },
      categoryBreakdown,
      monthlyTrends,
      accountInfo: {
        id: account._id.toString(),
        name: account.name || 'Mi Cuenta',
        type: account.type || 'personal'
      }
    };

    // Generate PDF based on format
    switch (exportDto.format) {
      case 'pdf':
        return this.pdfExportService.generateExpensesPdf(exportData, exportDto);

      case 'csv':
        // TODO: Implement CSV export
        throw new BadRequestException('CSV export not yet implemented');

      case 'excel':
        // TODO: Implement Excel export
        throw new BadRequestException('Excel export not yet implemented');

      default:
        throw new BadRequestException('Unsupported export format');
    }
  }
}
