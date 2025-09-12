import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './services/billing.service';
import { CreateCustomerDto, CreateSubscriptionDto } from './dto';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('customer')
  @ApiOperation({ summary: 'Get billing customer information' })
  @ApiResponse({ status: 200, description: 'Customer information retrieved successfully' })
  async getCustomer(@Req() req: RequestWithUser) {
    return this.billingService.getCustomerByUserId(req.user.sub);
  }

  @Post('customer')
  @ApiOperation({ summary: 'Create billing customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  async createCustomer(@Req() req: RequestWithUser, @Body() createCustomerDto: CreateCustomerDto) {
    // In a real implementation, you would integrate with Stripe here
    const stripeCustomerId = 'stripe_customer_id_placeholder';
    return this.billingService.createCustomer({ ...createCustomerDto, userId: req.user.sub }, stripeCustomerId);
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get user subscription' })
  @ApiResponse({ status: 200, description: 'Subscription retrieved successfully' })
  async getSubscription(@Req() req: RequestWithUser) {
    return this.billingService.getSubscriptionByUserId(req.user.sub);
  }

  @Post('subscription')
  @ApiOperation({ summary: 'Create subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  async createSubscription(@Req() req: RequestWithUser, @Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.billingService.createSubscription({
      ...createSubscriptionDto,
      userId: req.user.sub
    });
  }

  @Delete('subscription')
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription canceled successfully' })
  async cancelSubscription(@Req() req: RequestWithUser) {
    await this.billingService.cancelSubscription(req.user.sub);
    return { message: 'Subscription canceled successfully' };
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get payment history' })
  @ApiResponse({ status: 200, description: 'Payment history retrieved successfully' })
  async getPayments(@Req() req: RequestWithUser, @Query('limit') limit?: number, @Query('skip') skip?: number) {
    return this.billingService.getPaymentsByUserId(req.user.sub, limit || 20, skip || 0);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  async getUsage(@Req() req: RequestWithUser) {
    const subscription = await this.billingService.getSubscriptionByUserId(req.user.sub);
    if (!subscription) {
      return { message: 'No active subscription found' };
    }
    return subscription.usage;
  }

  @Get('usage/:feature')
  @ApiOperation({ summary: 'Check feature usage limit' })
  @ApiResponse({ status: 200, description: 'Usage limit check completed' })
  async checkUsageLimit(@Req() req: RequestWithUser, @Param('feature') feature: string) {
    return this.billingService.checkUsageLimit(req.user.sub, feature);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get billing statistics' })
  @ApiResponse({ status: 200, description: 'Billing statistics retrieved successfully' })
  async getStats(@Req() req: RequestWithUser) {
    return this.billingService.getBillingStats(req.user.sub);
  }
}
