import { StatsPeriod } from '@common/constants/card-types';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { UserForJWT } from '../users/types/user.types';
import { CardsService } from './cards.service';
import { CurrentCard } from './decorators/current-card.decorator';
import { CardQueryDto, CardStatisticsResponseDto, CreateCardBalanceDto, CreateCardDto, DebtSummaryDto, PaymentDueSummaryDto, UpdateCardDto } from './dto';
import { CardOwnershipGuard } from './guards/card-ownership.guard';
import { IMaskedCard } from './interfaces/card.interface';
import { CardAnalyticsService } from './services/card-analytics.service';

@ApiTags('Cards')
@Controller('cards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CardsController {
  constructor(
    private readonly cardsService: CardsService,
    private readonly cardAnalyticsService: CardAnalyticsService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new card' })
  @ApiBody({ type: CreateCardDto })
  @ApiResponse({
    status: 201,
    description: 'Card created successfully',
    type: Object // We'll define proper response DTOs later
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation errors or business rule violations'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - card name already exists or limit exceeded'
  })
  async create(@Body() createCardDto: CreateCardDto, @CurrentUser() user: UserForJWT): Promise<{ success: boolean; data: IMaskedCard; message: string }> {
    const card = await this.cardsService.createCard(user.id, createCardDto.profileId, createCardDto);

    return {
      success: true,
      data: card,
      message: 'Card created successfully'
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all cards for user/account' })
  @ApiQuery({ type: CardQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Cards retrieved successfully'
  })
  async findAll(
    @Query() query: CardQueryDto,
    @CurrentUser() user: UserForJWT
  ): Promise<{
    success: boolean;
    data: {
      cards: IMaskedCard[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
    message: string;
  }> {
    if (!query.profileId) {
      // If no profileId provided, we need to get it from somewhere
      // For now, we'll throw an error. In a real implementation,
      // we might get the default profile or all profiles for the user
      throw new Error('Profile ID is required');
    }

    const result = await this.cardsService.findAllCards(user.id, query.profileId, query);

    return {
      success: true,
      data: {
        cards: result.cards,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      },
      message: 'Cards retrieved successfully'
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get card details by ID' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiResponse({
    status: 200,
    description: 'Card retrieved successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Card not found'
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not card owner'
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: UserForJWT): Promise<{ success: boolean; data: IMaskedCard; message: string }> {
    const card = await this.cardsService.findCardById(id, user.id);

    return {
      success: true,
      data: card,
      message: 'Card retrieved successfully'
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update card details' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiBody({ type: UpdateCardDto })
  @ApiResponse({
    status: 200,
    description: 'Card updated successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Card not found'
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not card owner'
  })
  async update(
    @Param('id') id: string,
    @Body() updateCardDto: UpdateCardDto,
    @CurrentUser() user: UserForJWT
  ): Promise<{ success: boolean; data: IMaskedCard; message: string }> {
    const card = await this.cardsService.updateCard(id, user.id, updateCardDto);

    return {
      success: true,
      data: card,
      message: 'Card updated successfully'
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a card' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiResponse({
    status: 204,
    description: 'Card deleted successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Card not found'
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not card owner'
  })
  async remove(@Param('id') id: string, @CurrentUser() user: UserForJWT): Promise<void> {
    await this.cardsService.softDeleteCard(id, user.id);
  }

  @Post(':id/set-default')
  @ApiOperation({ summary: 'Set card as default for account' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        profileId: {
          type: 'string',
          description: 'Profile ID'
        }
      },
      required: ['profileId']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Card set as default successfully'
  })
  async setDefault(
    @Param('id') id: string,
    @Body('profileId') profileId: string,
    @CurrentUser() user: UserForJWT
  ): Promise<{ success: boolean; data: IMaskedCard; message: string }> {
    const card = await this.cardsService.setDefaultCard(id, user.id, profileId);

    return {
      success: true,
      data: card,
      message: 'Card set as default successfully'
    };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a card' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiResponse({
    status: 200,
    description: 'Card activated successfully'
  })
  async activate(@Param('id') id: string, @CurrentUser() user: UserForJWT): Promise<{ success: boolean; data: IMaskedCard; message: string }> {
    const card = await this.cardsService.activateCard(id, user.id);

    return {
      success: true,
      data: card,
      message: 'Card activated successfully'
    };
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a card' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiResponse({
    status: 200,
    description: 'Card deactivated successfully'
  })
  async deactivate(@Param('id') id: string, @CurrentUser() user: UserForJWT): Promise<{ success: boolean; data: IMaskedCard; message: string }> {
    const card = await this.cardsService.deactivateCard(id, user.id);

    return {
      success: true,
      data: card,
      message: 'Card deactivated successfully'
    };
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get current card balance' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiResponse({
    status: 200,
    description: 'Card balance retrieved successfully'
  })
  async getBalance(@Param('id') id: string, @CurrentUser() user: UserForJWT): Promise<{ success: boolean; data: any; message: string }> {
    const balance = await this.cardsService.getCardBalance(id, user.id);

    return {
      success: true,
      data: balance,
      message: 'Card balance retrieved successfully'
    };
  }

  @Post(':id/balance')
  @ApiOperation({ summary: 'Update card balance' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiBody({ type: CreateCardBalanceDto })
  @ApiResponse({
    status: 200,
    description: 'Card balance updated successfully'
  })
  async updateBalance(
    @Param('id') id: string,
    @Body() balanceDto: CreateCardBalanceDto,
    @CurrentUser() user: UserForJWT
  ): Promise<{ success: boolean; data: any; message: string }> {
    const balance = await this.cardsService.updateCardBalance(id, user.id, balanceDto);

    return {
      success: true,
      data: balance,
      message: 'Card balance updated successfully'
    };
  }

  @Get('summary/payment-due')
  @ApiOperation({ summary: 'Get payment due summary for all user cards' })
  @ApiResponse({
    status: 200,
    description: 'Payment due summary retrieved successfully',
    type: PaymentDueSummaryDto
  })
  async getPaymentDueSummary(@CurrentUser() user: UserForJWT): Promise<{ success: boolean; data: any[]; message: string }> {
    const summary = await this.cardsService.getPaymentDueSummary(user.id);

    return {
      success: true,
      data: summary,
      message: 'Payment due summary retrieved successfully'
    };
  }

  @Get('summary/total-debt')
  @ApiOperation({ summary: 'Get total debt across all cards' })
  @ApiQuery({
    name: 'profileId',
    required: false,
    description: 'Filter by profile ID'
  })
  @ApiResponse({
    status: 200,
    description: 'Total debt summary retrieved successfully',
    type: DebtSummaryDto
  })
  async getTotalDebt(@CurrentUser() user: UserForJWT, @Query('profileId') profileId?: string): Promise<{ success: boolean; data: any; message: string }> {
    const summary = await this.cardsService.getTotalDebtAcrossCards(user.id, profileId);

    return {
      success: true,
      data: summary,
      message: 'Total debt summary retrieved successfully'
    };
  }

  @Get(':id/analytics')
  @UseGuards(CardOwnershipGuard)
  @ApiOperation({ summary: 'Get card analytics and statistics' })
  @ApiParam({ name: 'id', description: 'Card ID' })
  @ApiQuery({ name: 'period', enum: StatsPeriod, required: false })
  @ApiQuery({ name: 'startDate', required: false, description: 'Custom start date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Custom end date' })
  async getAnalytics(
    @Param('id') id: string,
    @CurrentUser() user: UserForJWT,
    @Query('period') period?: StatsPeriod,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<{ success: boolean; data: any; message: string }> {
    const customStartDate = startDate ? new Date(startDate) : undefined;
    const customEndDate = endDate ? new Date(endDate) : undefined;

    const analytics = await this.cardAnalyticsService.getCardStatistics(id, period, customStartDate, customEndDate);

    return {
      success: true,
      data: analytics,
      message: 'Card analytics retrieved successfully'
    };
  }
}
