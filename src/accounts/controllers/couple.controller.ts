import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, Request, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';

import { CoupleService } from '../services/couple.service';
import { ExpenseContextParserService } from '../../common/services/expense-context-parser.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import {
  UpdateCoupleSettingsDto,
  CoupleSettingsResponseDto,
  AcceptCoupleInvitationDto,
  CoupleStatsDto,
  ExpenseContextParseDto
} from '../dto/couple-settings.dto';

import { CoupleReactionType } from '@common/constants/couple-types';

@ApiTags('Couple Management')
@Controller('couples')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CoupleController {
  constructor(
    private readonly coupleService: CoupleService,
    private readonly contextParserService: ExpenseContextParserService
  ) {}

  @Post(':accountId/accept-invitation')
  @ApiOperation({
    summary: 'Accept couple invitation',
    description: 'Accept invitation to couple account and optionally set initial preferences'
  })
  @ApiParam({ name: 'accountId', description: 'Couple account ID' })
  @ApiBody({ type: AcceptCoupleInvitationDto, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Couple invitation accepted successfully',
    type: CoupleSettingsResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Couple account not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not authorized to accept this invitation'
  })
  async acceptCoupleInvitation(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Request() req: any,
    @Body() acceptDto?: AcceptCoupleInvitationDto
  ): Promise<CoupleSettingsResponseDto> {
    return this.coupleService.acceptCoupleInvitation(accountId, req.user.id, acceptDto);
  }

  @Get(':accountId/settings')
  @ApiOperation({
    summary: 'Get couple settings',
    description: 'Retrieve couple account settings and preferences'
  })
  @ApiParam({ name: 'accountId', description: 'Couple account ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Couple settings retrieved successfully',
    type: CoupleSettingsResponseDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Couple account or settings not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have access to this couple account'
  })
  async getCoupleSettings(@Param('accountId', ParseUUIDPipe) accountId: string, @Request() req: any): Promise<CoupleSettingsResponseDto> {
    return this.coupleService.getCoupleSettings(accountId, req.user.id);
  }

  @Put(':accountId/settings')
  @ApiOperation({
    summary: 'Update couple settings',
    description: 'Update couple account settings and preferences'
  })
  @ApiParam({ name: 'accountId', description: 'Couple account ID' })
  @ApiBody({ type: UpdateCoupleSettingsDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Couple settings updated successfully',
    type: CoupleSettingsResponseDto
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid settings or validation failed'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Couple account or settings not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have access to this couple account'
  })
  async updateCoupleSettings(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Request() req: any,
    @Body() updateDto: UpdateCoupleSettingsDto
  ): Promise<CoupleSettingsResponseDto> {
    return this.coupleService.updateCoupleSettings(accountId, req.user.id, updateDto);
  }

  @Get(':accountId/stats')
  @ApiOperation({
    summary: 'Get couple statistics',
    description: 'Retrieve couple dashboard statistics and analytics'
  })
  @ApiParam({ name: 'accountId', description: 'Couple account ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: Date,
    description: 'Start date for statistics period'
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: Date,
    description: 'End date for statistics period'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Couple statistics retrieved successfully',
    type: CoupleStatsDto
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Couple account not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have access to this couple account'
  })
  async getCoupleStats(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<CoupleStatsDto> {
    const dateRange =
      startDate && endDate
        ? {
            startDate: new Date(startDate),
            endDate: new Date(endDate)
          }
        : undefined;

    return this.coupleService.getCoupleStats(accountId, req.user.id, dateRange);
  }

  @Post('expenses/:expenseId/comments')
  @ApiOperation({
    summary: 'Add comment to couple expense',
    description: 'Add a comment to a couple expense'
  })
  @ApiParam({ name: 'expenseId', description: 'Expense ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        comment: {
          type: 'string',
          description: 'Comment text',
          minLength: 1,
          maxLength: 500
        }
      },
      required: ['comment']
    }
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Comment added successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        comment: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            text: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            isEdited: { type: 'boolean' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid expense or comments not allowed'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Expense not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have access to this expense'
  })
  async addExpenseComment(@Param('expenseId', ParseUUIDPipe) expenseId: string, @Request() req: any, @Body('comment') comment: string) {
    if (!comment || comment.trim().length === 0) {
      throw new Error('Comment text is required');
    }

    return this.coupleService.addExpenseComment(expenseId, req.user.id, comment);
  }

  @Post('expenses/:expenseId/reactions')
  @ApiOperation({
    summary: 'Add reaction to couple expense',
    description: 'Add or update a reaction to a couple expense'
  })
  @ApiParam({ name: 'expenseId', description: 'Expense ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: Object.values(CoupleReactionType),
          description: 'Reaction type'
        }
      },
      required: ['type']
    }
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Reaction added successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        reaction: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            type: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid expense or reactions not allowed'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Expense not found'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have access to this expense'
  })
  async addExpenseReaction(@Param('expenseId', ParseUUIDPipe) expenseId: string, @Request() req: any, @Body('type') reactionType: CoupleReactionType) {
    if (!Object.values(CoupleReactionType).includes(reactionType)) {
      throw new Error('Invalid reaction type');
    }

    return this.coupleService.addExpenseReaction(expenseId, req.user.id, reactionType);
  }

  @Post('parse-context')
  @ApiOperation({
    summary: 'Parse expense context',
    description: 'Parse expense description to extract context (@pareja, @personal, etc.)'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Expense description with context',
          example: '$50 groceries @pareja'
        }
      },
      required: ['description']
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Context parsed successfully',
    type: ExpenseContextParseDto
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid description format'
  })
  async parseExpenseContext(@Request() req: any, @Body('description') description: string): Promise<ExpenseContextParseDto> {
    if (!description || description.trim().length === 0) {
      throw new Error('Description is required');
    }

    const parsed = await this.contextParserService.parseExpenseContext(description, req.user.id);

    return {
      description,
      context: parsed.context || undefined,
      cleanDescription: parsed.cleanDescription,
      suggestedAccountId: parsed.suggestedAccountId,
      expenseType: parsed.expenseType
    };
  }

  @Post('suggest-context')
  @ApiOperation({
    summary: 'Get context suggestions',
    description: 'Get AI-powered context suggestions for expense'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Expense description',
          example: 'Dinner at restaurant'
        },
        amount: {
          type: 'number',
          description: 'Expense amount',
          minimum: 0,
          example: 75.5
        },
        category: {
          type: 'string',
          description: 'Expense category (optional)',
          example: 'dining'
        }
      },
      required: ['description', 'amount']
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Context suggestions generated successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          suggestedContext: {
            type: 'string',
            enum: ['personal', 'couple', 'family', 'business']
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          reason: {
            type: 'string'
          }
        }
      }
    }
  })
  async suggestExpenseContext(@Request() req: any, @Body() body: { description: string; amount: number; category?: string }) {
    if (!body.description || body.amount < 0) {
      throw new Error('Valid description and amount are required');
    }

    return this.contextParserService.suggestContext(body.description, body.amount, req.user.id, body.category);
  }
}
