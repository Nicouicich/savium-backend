import { BadRequestException, Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@ApiTags('AI Integration')
@Controller('integrations/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get AI service status',
    description: 'Get current AI integration status and available features'
  })
  @ApiResponse({ status: 200, description: 'AI service status retrieved' })
  async getStatus() {
    return this.aiService.getServiceStatus();
  }

  @Post('process-ticket')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Process receipt/ticket image',
    description: 'Extract expense information from receipt image using AI (structure only - not implemented)'
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket processed successfully (mock response)'
  })
  async processTicket(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    if (!this.aiService.isAiEnabled()) {
      return {
        message: 'AI integration not implemented',
        note: 'This endpoint structure is ready but AI processing is not active',
        mockData: await this.aiService.processTicketImage(file.buffer, file.mimetype)
      };
    }

    return this.aiService.processTicketImage(file.buffer, file.mimetype);
  }

  @Post('categorize')
  @ApiOperation({
    summary: 'Categorize expense using AI',
    description: 'Suggest expense categories based on description and context (structure only - not implemented)'
  })
  @ApiResponse({
    status: 200,
    description: 'Categorization suggestions provided (mock response)'
  })
  async categorizeExpense(@Body() body: { description: string; amount: number; vendor?: string }, @CurrentUser() user: any) {
    const { description, amount, vendor } = body;

    if (!description || !amount) {
      throw new BadRequestException('Description and amount are required');
    }

    if (!this.aiService.isAiEnabled()) {
      return {
        message: 'AI integration not implemented',
        note: 'This endpoint structure is ready but AI processing is not active',
        mockData: await this.aiService.categorizeExpense(
          description,
          amount,
          ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Hogar', 'Otros'],
          vendor
        )
      };
    }

    return this.aiService.categorizeExpense(description, amount, ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Hogar', 'Otros'], vendor);
  }

  @Post('analyze-spending')
  @ApiOperation({
    summary: 'Analyze spending patterns',
    description: 'Get AI-powered insights and recommendations for spending patterns (structure only - not implemented)'
  })
  @ApiResponse({
    status: 200,
    description: 'Spending analysis provided (mock response)'
  })
  async analyzeSpending(@Body() body: { accountId: string; timeframe?: string }, @CurrentUser() user: any) {
    const { accountId } = body;

    if (!accountId) {
      throw new BadRequestException('Account ID is required');
    }

    if (!this.aiService.isAiEnabled()) {
      return {
        message: 'AI integration not implemented',
        note: 'This endpoint structure is ready but AI processing is not active',
        mockData: await this.aiService.analyzeSpendingPatterns([])
      };
    }

    // In real implementation, fetch expenses for the account and timeframe
    return this.aiService.analyzeSpendingPatterns([]);
  }

  @Post('suggest-budgets')
  @ApiOperation({
    summary: 'Get AI budget suggestions',
    description: 'Get AI-generated budget suggestions based on spending history (structure only - not implemented)'
  })
  @ApiResponse({
    status: 200,
    description: 'Budget suggestions provided (mock response)'
  })
  async suggestBudgets(@Body() body: { accountId: string; accountType?: string }, @CurrentUser() user: any) {
    const { accountId, accountType } = body;

    if (!accountId) {
      throw new BadRequestException('Account ID is required');
    }

    if (!this.aiService.isAiEnabled()) {
      return {
        message: 'AI integration not implemented',
        note: 'This endpoint structure is ready but AI processing is not active',
        mockData: await this.aiService.generateBudgetSuggestions([], accountType || 'personal')
      };
    }

    // In real implementation, fetch historical expenses for the account
    return this.aiService.generateBudgetSuggestions([], accountType || 'personal');
  }
}
