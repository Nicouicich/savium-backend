import {Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ValidationPipe} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags} from '@nestjs/swagger';

import {AccountsService} from './accounts.service';
import {AccountResponseDto, CreateAccountDto, InviteMemberDto, UpdateAccountDto, UpdateMemberDto} from './dto';

import {JwtAuthGuard} from '@common/guards/jwt-auth.guard';
import {CurrentUser} from '@common/decorators/current-user.decorator';
import {ApiResponseDto} from '@common/decorators/api-response.decorator';

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({summary: 'Create a new account'})
  @ApiResponseDto(AccountResponseDto, 201, 'Account created successfully')
  @ApiResponse({status: 400, description: 'Invalid input data'})
  @ApiResponse({status: 409, description: 'Account limit exceeded'})
  async create(@CurrentUser('id') userId: string, @Body(ValidationPipe) createAccountDto: CreateAccountDto): Promise<AccountResponseDto> {
    return this.accountsService.create(userId, createAccountDto);
  }

  @Get()
  @ApiOperation({summary: 'Get all user accounts'})
  @ApiResponseDto([AccountResponseDto], 200, 'Accounts retrieved successfully')
  async findAll(@CurrentUser('id') userId: string): Promise<AccountResponseDto[]> {
    return this.accountsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({summary: 'Get account by ID'})
  @ApiParam({name: 'id', description: 'Account ID'})
  @ApiResponseDto(AccountResponseDto, 200, 'Account retrieved successfully')
  @ApiResponse({status: 404, description: 'Account not found'})
  @ApiResponse({status: 403, description: 'Access denied'})
  async findOne(@Param('id') id: string, @CurrentUser('id') userId: string): Promise<AccountResponseDto> {
    return this.accountsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({summary: 'Update account'})
  @ApiParam({name: 'id', description: 'Account ID'})
  @ApiResponseDto(AccountResponseDto, 200, 'Account updated successfully')
  @ApiResponse({status: 404, description: 'Account not found'})
  @ApiResponse({status: 403, description: 'Insufficient permissions'})
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) updateAccountDto: UpdateAccountDto
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(id, userId, updateAccountDto);
  }

  @Delete(':id')
  @ApiOperation({summary: 'Delete account'})
  @ApiParam({name: 'id', description: 'Account ID'})
  @ApiResponse({status: 200, description: 'Account deleted successfully'})
  @ApiResponse({status: 404, description: 'Account not found'})
  @ApiResponse({status: 403, description: 'Only owner can delete account'})
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string): Promise<{message: string}> {
    await this.accountsService.remove(id, userId);
    return {message: 'Account deleted successfully'};
  }

  @Post(':id/invite')
  @ApiOperation({summary: 'Invite member to account'})
  @ApiParam({name: 'id', description: 'Account ID'})
  @ApiResponse({
    status: 201,
    description: 'Invitation sent successfully',
    schema: {type: 'object', properties: {message: {type: 'string'}, invitationId: {type: 'string'}}}
  })
  @ApiResponse({status: 404, description: 'Account not found'})
  @ApiResponse({status: 403, description: 'Insufficient permissions'})
  @ApiResponse({status: 409, description: 'User already member or invitation exists'})
  async inviteMember(
    @Param('id') accountId: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) inviteMemberDto: InviteMemberDto
  ): Promise<{message: string; invitationId: string}> {
    return this.accountsService.inviteMember(accountId, userId, inviteMemberDto);
  }

  @Post('invitations/:token/accept')
  @ApiOperation({summary: 'Accept account invitation'})
  @ApiParam({name: 'token', description: 'Invitation token'})
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    schema: {type: 'object', properties: {message: {type: 'string'}, account: {$ref: '#/components/schemas/AccountResponseDto'}}}
  })
  @ApiResponse({status: 404, description: 'Invalid or expired invitation'})
  @ApiResponse({status: 409, description: 'Already a member'})
  async acceptInvitation(@Param('token') token: string, @CurrentUser('id') userId: string): Promise<{message: string; account: AccountResponseDto}> {
    return this.accountsService.acceptInvitation(token, userId);
  }

  @Post('invitations/:token/reject')
  @ApiOperation({summary: 'Reject account invitation'})
  @ApiParam({name: 'token', description: 'Invitation token'})
  @ApiResponse({status: 200, description: 'Invitation rejected successfully', schema: {type: 'object', properties: {message: {type: 'string'}}}})
  @ApiResponse({status: 404, description: 'Invalid or expired invitation'})
  async rejectInvitation(@Param('token') token: string): Promise<{message: string}> {
    return this.accountsService.rejectInvitation(token);
  }

  @Patch(':id/members/:memberId')
  @ApiOperation({summary: 'Update account member'})
  @ApiParam({name: 'id', description: 'Account ID'})
  @ApiParam({name: 'memberId', description: 'Member user ID'})
  @ApiResponseDto(AccountResponseDto, 200, 'Member updated successfully')
  @ApiResponse({status: 404, description: 'Account or member not found'})
  @ApiResponse({status: 403, description: 'Insufficient permissions'})
  async updateMember(
    @Param('id') accountId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) updateMemberDto: UpdateMemberDto
  ): Promise<AccountResponseDto> {
    return this.accountsService.updateMember(accountId, memberId, userId, updateMemberDto);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({summary: 'Remove member from account'})
  @ApiParam({name: 'id', description: 'Account ID'})
  @ApiParam({name: 'memberId', description: 'Member user ID'})
  @ApiResponse({status: 200, description: 'Member removed successfully', schema: {type: 'object', properties: {message: {type: 'string'}}}})
  @ApiResponse({status: 404, description: 'Account or member not found'})
  @ApiResponse({status: 403, description: 'Insufficient permissions'})
  async removeMember(@Param('id') accountId: string, @Param('memberId') memberId: string, @CurrentUser('id') userId: string): Promise<{message: string}> {
    return this.accountsService.removeMember(accountId, memberId, userId);
  }

  @Get(':id/stats')
  @ApiOperation({summary: 'Get account statistics'})
  @ApiParam({name: 'id', description: 'Account ID'})
  @ApiResponse({
    status: 200,
    description: 'Account statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalMembers: {type: 'number'},
        activeMembers: {type: 'number'},
        pendingInvitations: {type: 'number'},
        accountType: {type: 'string'},
        createdAt: {type: 'string', format: 'date-time'}
      }
    }
  })
  @ApiResponse({status: 404, description: 'Account not found'})
  @ApiResponse({status: 403, description: 'Access denied'})
  async getStats(@Param('id') accountId: string, @CurrentUser('id') userId: string) {
    return this.accountsService.getAccountStats(accountId, userId);
  }

  @Get(':id/role')
  @ApiOperation({summary: 'Get user role in account'})
  @ApiParam({name: 'id', description: 'Account ID'})
  @ApiResponse({status: 200, description: 'User role retrieved successfully', schema: {type: 'object', properties: {role: {type: 'string', nullable: true}}}})
  async getUserRole(@Param('id') accountId: string, @CurrentUser('id') userId: string): Promise<{role: string | null}> {
    const role = await this.accountsService.getUserRole(accountId, userId);
    return {role};
  }
}
