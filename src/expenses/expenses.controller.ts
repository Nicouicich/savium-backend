import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { FileUploadService } from './file-upload.service';
import { CreateExpenseDto, ExpenseQueryDto, ExpenseResponseDto, UpdateExpenseDto } from './dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponseDecorator } from '@common/decorators/api-response.decorator';
import { Currency } from '@common/constants/expense-categories';
import { ValidationException } from '@common/exceptions';

@ApiTags('Expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly fileUploadService: FileUploadService
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new expense',
    description: 'Create a new expense entry for the specified account'
  })
  @ApiResponseDecorator(ExpenseResponseDto, 201, 'Expense created successfully')
  async create(@Body() createExpenseDto: CreateExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.create(createExpenseDto, user.id);
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 5))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload receipt files for an expense',
    description: 'Upload receipt images or PDFs. Can be used for AI processing.'
  })
  @ApiResponse({ status: 201, description: 'Files uploaded successfully' })
  async uploadReceipts(@UploadedFiles() files: Express.Multer.File[], @Body() createExpenseDto: CreateExpenseDto, @CurrentUser() user: any) {
    if (!files || files.length === 0) {
      throw new ValidationException('At least one file must be provided');
    }

    return this.expensesService.createWithFiles(createExpenseDto, files, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all expenses with filtering and pagination',
    description: 'Retrieve expenses with various filtering options and pagination'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'accountId', required: false, type: String, description: 'Filter by account ID' })
  @ApiQuery({ name: 'categoryId', required: false, type: String, description: 'Filter by category ID' })
  @ApiQuery({ name: 'startDate', required: false, type: Date, description: 'Start date filter' })
  @ApiQuery({ name: 'endDate', required: false, type: Date, description: 'End date filter' })
  @ApiQuery({ name: 'minAmount', required: false, type: Number, description: 'Minimum amount filter' })
  @ApiQuery({ name: 'maxAmount', required: false, type: Number, description: 'Maximum amount filter' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in description, vendor, notes' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Sort field (date, amount, description)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  @ApiResponseDecorator([ExpenseResponseDto], 200, 'Expenses retrieved successfully')
  async findAll(@Query() query: ExpenseQueryDto, @CurrentUser() user: any) {
    return this.expensesService.findAll(query, user.id);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get expense statistics',
    description: 'Get statistical data about expenses for analysis'
  })
  @ApiQuery({ name: 'accountId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'currency', required: false, enum: Currency })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully'
  })
  async getStats(
    @Query('accountId') accountId?: string,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('currency') currency?: Currency,
    @CurrentUser() user?: any
  ) {
    return this.expensesService.getExpenseStats(accountId, user?.id, startDate, endDate, currency);
  }

  @Get('category-breakdown')
  @ApiOperation({
    summary: 'Get expense breakdown by category',
    description: 'Get spending breakdown by categories for the specified account'
  })
  @ApiQuery({ name: 'accountId', required: true, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiResponse({
    status: 200,
    description: 'Category breakdown retrieved successfully'
  })
  async getCategoryBreakdown(
    @Query('accountId') accountId: string,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @CurrentUser() user?: any
  ) {
    return this.expensesService.getCategoryBreakdown(accountId, user.id, startDate, endDate);
  }

  @Get('monthly-trends')
  @ApiOperation({
    summary: 'Get monthly spending trends',
    description: 'Get spending trends over the past months'
  })
  @ApiQuery({ name: 'accountId', required: true, type: String })
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'Number of months to analyze' })
  @ApiResponse({
    status: 200,
    description: 'Monthly trends retrieved successfully'
  })
  async getMonthlyTrends(
    @Query('accountId') accountId: string,
    @Query('months', new DefaultValuePipe(12), ParseIntPipe) months: number,
    @CurrentUser() user: any
  ) {
    return this.expensesService.getMonthlyTrends(accountId, user.id, months);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search expenses',
    description: 'Search expenses by description, vendor, notes, or tags'
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @ApiQuery({ name: 'accountId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponseDecorator([ExpenseResponseDto], 200, 'Search results retrieved successfully')
  async search(
    @Query('q') searchTerm: string,
    @Query('accountId') accountId?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @CurrentUser() user?: any
  ) {
    return this.expensesService.searchExpenses(searchTerm, accountId, user?.id, limit);
  }

  @Get('account/:accountId')
  @ApiOperation({
    summary: 'Get expenses by account',
    description: 'Get all expenses for a specific account with pagination'
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponseDecorator([ExpenseResponseDto], 200, 'Account expenses retrieved successfully')
  async findByAccount(
    @Param('accountId') accountId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('sortBy', new DefaultValuePipe('date')) sortBy?: string,
    @Query('sortOrder', new DefaultValuePipe('desc'))
    sortOrder?: 'asc' | 'desc',
    @CurrentUser() user?: any
  ) {
    return this.expensesService.findByAccount(
      accountId,
      {
        page,
        limit,
        startDate,
        endDate,
        sortBy,
        sortOrder
      },
      user?.id
    );
  }

  @Get('category/:categoryId')
  @ApiOperation({
    summary: 'Get expenses by category',
    description: 'Get all expenses for a specific category'
  })
  @ApiQuery({ name: 'accountId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponseDecorator([ExpenseResponseDto], 200, 'Category expenses retrieved successfully')
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query('accountId') accountId?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
    @CurrentUser() user?: any
  ) {
    return this.expensesService.findByCategory(categoryId, accountId, user?.id, limit);
  }

  @Get('review')
  @ApiOperation({
    summary: 'Get expenses needing review',
    description: 'Get all expenses that need review for the specified account (admin only)'
  })
  @ApiQuery({ name: 'accountId', required: true, type: String })
  @ApiResponseDecorator([ExpenseResponseDto], 200, 'Review expenses retrieved successfully')
  async findExpensesNeedingReview(@Query('accountId') accountId: string, @CurrentUser() user: any) {
    return this.expensesService.findExpensesNeedingReview(accountId, user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get expense by ID',
    description: 'Get a specific expense by its ID'
  })
  @ApiResponseDecorator(ExpenseResponseDto, 200, 'Expense retrieved successfully')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.expensesService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an expense',
    description: 'Update an existing expense'
  })
  @ApiResponseDecorator(ExpenseResponseDto, 200, 'Expense updated successfully')
  async update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.update(id, updateExpenseDto, user.id);
  }

  @Patch(':id/review')
  @ApiOperation({
    summary: 'Review an expense',
    description: 'Approve or reject an expense that needs review (admin only)'
  })
  @ApiResponse({ status: 200, description: 'Expense reviewed successfully' })
  async reviewExpense(@Param('id') id: string, @Body('approved') approved: boolean = true, @CurrentUser() user: any) {
    return this.expensesService.markAsReviewed(id, user.id, approved);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an expense',
    description: 'Soft delete an expense (marks as deleted)'
  })
  @ApiResponse({ status: 200, description: 'Expense deleted successfully' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.expensesService.remove(id, user.id);
    return { message: 'Expense deleted successfully' };
  }
}
