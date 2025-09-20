import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import { RedeemRewardsDto, RedeemRewardsResponseDto } from './dto/redeem-rewards.dto';
import { ReferralCodeResponseDto } from './dto/referral-code-response.dto';
import { ReferralHistoryQueryDto } from './dto/referral-history-query.dto';
import { ReferralHistoryResponseDto } from './dto/referral-history-response.dto';
import { ReferralSettingsResponseDto, UpdateReferralSettingsDto } from './dto/referral-settings.dto';
import { ReferralStatsQueryDto } from './dto/referral-stats-query.dto';
import { ReferralStatsResponseDto } from './dto/referral-stats-response.dto';
import { RewardsQueryDto } from './dto/rewards-query.dto';
import { RewardsResponseDto } from './dto/rewards-response.dto';
import { ValidateReferralResponseDto } from './dto/validate-referral-response.dto';
import { ReferralsService } from './referrals.service';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('my-code')
  @ApiOperation({
    summary: 'Get my referral code and statistics',
    description: 'Retrieves the current user\'s referral code along with basic statistics including total referrals, successful referrals, and conversion rate.'
  })
  @ApiResponse({
    status: 200,
    description: 'Referral code and statistics retrieved successfully',
    type: ReferralCodeResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  async getMyReferralCode(@CurrentUser('id') userId: string): Promise<ReferralCodeResponseDto> {
    return this.referralsService.getMyReferralCode(userId);
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Apply a referral code',
    description: 'Applies a referral code to the current user. The user must not have been previously referred by anyone.'
  })
  @ApiResponse({
    status: 200,
    description: 'Referral code applied successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Referral code applied successfully' },
        referrerInfo: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john@example.com' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid referral code, self-referral, or user already referred'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  async applyReferralCode(
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyReferralDto
  ): Promise<{ success: boolean; message: string; referrerInfo?: any }> {
    return this.referralsService.applyReferralCode(userId, dto);
  }

  @Get('validate/:code')
  @ApiOperation({
    summary: 'Validate a referral code',
    description: 'Validates whether a referral code exists and is valid. Returns information about the referrer if valid.'
  })
  @ApiParam({
    name: 'code',
    description: 'The referral code to validate',
    example: 'john_doe'
  })
  @ApiResponse({
    status: 200,
    description: 'Referral code validation result',
    type: ValidateReferralResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  async validateReferralCode(@Param('code') code: string): Promise<ValidateReferralResponseDto> {
    return this.referralsService.validateReferralCode(code);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get referral statistics',
    description: 'Retrieves comprehensive referral statistics including overview data and chart data for the specified time period.'
  })
  @ApiQuery({
    name: 'period',
    enum: ['7d', '30d', '90d', '1y', 'all'],
    required: false,
    description: 'Time period for statistics'
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Custom start date (ISO format)'
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Custom end date (ISO format)'
  })
  @ApiQuery({
    name: 'timezone',
    required: false,
    description: 'Timezone for date calculations',
    example: 'America/New_York'
  })
  @ApiResponse({
    status: 200,
    description: 'Referral statistics retrieved successfully',
    type: ReferralStatsResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  async getReferralStats(@CurrentUser('id') userId: string, @Query() query: ReferralStatsQueryDto): Promise<ReferralStatsResponseDto> {
    return this.referralsService.getReferralStats(userId, query);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get referral history',
    description: 'Retrieves a paginated list of users referred by the current user with filtering and sorting options.'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10, max: 100)'
  })
  @ApiQuery({
    name: 'status',
    enum: ['all', 'pending', 'completed'],
    required: false,
    description: 'Filter by referral status'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name or email'
  })
  @ApiQuery({
    name: 'sortBy',
    enum: ['createdAt', 'completedAt', 'name', 'email', 'rewardAmount'],
    required: false,
    description: 'Field to sort by'
  })
  @ApiQuery({
    name: 'sortOrder',
    enum: ['asc', 'desc'],
    required: false,
    description: 'Sort order'
  })
  @ApiResponse({
    status: 200,
    description: 'Referral history retrieved successfully',
    type: ReferralHistoryResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  async getReferralHistory(@CurrentUser('id') userId: string, @Query() query: ReferralHistoryQueryDto): Promise<ReferralHistoryResponseDto> {
    return this.referralsService.getReferralHistory(userId, query);
  }

  @Get('history/export')
  @ApiOperation({
    summary: 'Export referral history',
    description: 'Exports the complete referral history as a CSV file.'
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file with referral history',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          format: 'binary'
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  exportReferralHistory(): string {
    // This would implement CSV export functionality
    // For now, returning a placeholder
    return 'CSV export functionality to be implemented';
  }

  @Get('rewards')
  @ApiOperation({
    summary: 'Get referral rewards',
    description: 'Retrieves a paginated list of referral rewards for the current user with filtering options and summary statistics.'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10, max: 100)'
  })
  @ApiQuery({
    name: 'status',
    enum: ['all', 'pending', 'available', 'redeemed', 'expired'],
    required: false,
    description: 'Filter by reward status'
  })
  @ApiResponse({
    status: 200,
    description: 'Referral rewards retrieved successfully',
    type: RewardsResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  async getRewards(@CurrentUser('id') userId: string, @Query() query: RewardsQueryDto): Promise<RewardsResponseDto> {
    return this.referralsService.getRewards(userId, query);
  }

  @Post('rewards/redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Redeem referral rewards',
    description: 'Redeems selected available rewards using the specified redemption method. All rewards must be available for redemption.'
  })
  @ApiResponse({
    status: 200,
    description: 'Rewards redeemed successfully',
    type: RedeemRewardsResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid reward IDs or rewards not available for redemption'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Some rewards are not available for redemption'
  })
  async redeemRewards(@CurrentUser('id') userId: string, @Body() dto: RedeemRewardsDto): Promise<RedeemRewardsResponseDto> {
    return this.referralsService.redeemRewards(userId, dto);
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Get referral settings',
    description: 'Retrieves the current user\'s referral settings including notification preferences, privacy settings, and reward preferences.'
  })
  @ApiResponse({
    status: 200,
    description: 'Referral settings retrieved successfully',
    type: ReferralSettingsResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  async getReferralSettings(@CurrentUser('id') userId: string): Promise<ReferralSettingsResponseDto> {
    return this.referralsService.getReferralSettings(userId);
  }

  @Put('settings')
  @ApiOperation({
    summary: 'Update referral settings',
    description: 'Updates the current user\'s referral settings. All fields are optional and only provided fields will be updated.'
  })
  @ApiResponse({
    status: 200,
    description: 'Referral settings updated successfully',
    type: ReferralSettingsResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid settings or custom referral code already in use'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Custom referral code is already in use'
  })
  async updateReferralSettings(@CurrentUser('id') userId: string, @Body() dto: UpdateReferralSettingsDto): Promise<ReferralSettingsResponseDto> {
    return this.referralsService.updateReferralSettings(userId, dto);
  }

  @Post('mark-active')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mark user as active',
    description: 'Marks the current user as active for referral tracking purposes. This should be called periodically during user sessions.'
  })
  @ApiResponse({
    status: 204,
    description: 'User marked as active successfully'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  async markUserActive(@CurrentUser('id') userId: string): Promise<void> {
    await this.referralsService.markUserActive(userId);
  }
}
