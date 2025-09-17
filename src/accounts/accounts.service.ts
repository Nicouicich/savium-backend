import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';

import { AccountsRepository } from './accounts.repository';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AccountResponseDto, CreateAccountDto, InviteMemberDto, UpdateAccountDto, UpdateMemberDto } from './dto';
import { CoupleService } from './services/couple.service';

import { ACCOUNT_TYPE_CONFIG, AccountType, DEFAULT_PRIVACY_SETTINGS, InvitationStatus } from '@common/constants/account-types';
import { AccountRole, Permission, ROLE_PERMISSIONS } from '@common/constants/user-roles';

@Injectable()
export class AccountsService {
  constructor(
    private readonly accountsRepository: AccountsRepository,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly coupleService: CoupleService
  ) {}

  async create(userId: string, createAccountDto: CreateAccountDto): Promise<AccountResponseDto> {
    // Check if user already has maximum accounts for this type
    const userAccounts = await this.accountsRepository.findByUserId(userId);
    const accountsOfType = userAccounts.filter(account => account.type === createAccountDto.type);

    // Personal accounts: limit to 1, others: limit to 5
    const maxAccounts = createAccountDto.type === AccountType.PERSONAL ? 1 : 5;
    if (accountsOfType.length >= maxAccounts) {
      throw new BadRequestException(`You can only have ${maxAccounts} ${createAccountDto.type} account(s)`);
    }

    // Set default privacy settings based on account type
    const privacySettings = {
      ...DEFAULT_PRIVACY_SETTINGS[createAccountDto.type],
      ...createAccountDto.privacySettings
    };

    const accountData = {
      ...createAccountDto,
      privacySettings,
      currency: createAccountDto.currency || 'USD',
      timezone: createAccountDto.timezone || 'UTC'
    };

    const account = await this.accountsRepository.create(userId, accountData);

    // Initialize couple settings if this is a couple account
    if (createAccountDto.type === AccountType.COUPLE) {
      try {
        await this.coupleService.initializeCoupleSettings((account as any).id);
      } catch (error) {
        console.error('Error initializing couple settings:', error);
        // Continue without failing account creation
      }
    }

    return this.mapToResponseDto(account);
  }

  async findAll(userId: string): Promise<AccountResponseDto[]> {
    const accounts = await this.accountsRepository.findByUserId(userId);
    return accounts.map(account => this.mapToResponseDto(account));
  }

  async findOne(id: string, userId: string): Promise<AccountResponseDto> {
    const account = await this.accountsRepository.findById(id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Check if user has access to this account
    if (!this.hasAccountAccess(account, userId)) {
      throw new ForbiddenException('You do not have access to this account');
    }

    return this.mapToResponseDto(account);
  }

  async update(id: string, userId: string, updateAccountDto: UpdateAccountDto): Promise<AccountResponseDto> {
    const account = await this.accountsRepository.findById(id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Check permissions
    if (!this.canManageAccount(account, userId)) {
      throw new ForbiddenException('You do not have permission to update this account');
    }

    const updatedAccount = await this.accountsRepository.update(id, updateAccountDto);
    if (!updatedAccount) {
      throw new NotFoundException('Account not found');
    }

    return this.mapToResponseDto(updatedAccount);
  }

  async remove(id: string, userId: string): Promise<void> {
    const account = await this.accountsRepository.findById(id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Only owner can delete account
    if (account.owner.toString() !== userId) {
      throw new ForbiddenException('Only the account owner can delete the account');
    }

    await this.accountsRepository.softDelete(id);
  }

  async inviteMember(accountId: string, userId: string, inviteMemberDto: InviteMemberDto): Promise<{ message: string; invitationId: string }> {
    const account = await this.accountsRepository.findById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Check permissions
    if (!this.canInviteMembers(account, userId)) {
      throw new ForbiddenException('You do not have permission to invite members');
    }

    // Check if email is already a member
    const existingMember = account.members.find(member => (member.userId as any)?.email === inviteMemberDto.email);
    if (existingMember) {
      throw new ConflictException('User is already a member of this account');
    }

    // Check if there's already a pending invitation
    const pendingInvitation = account.pendingInvitations.find(invitation => invitation.email === inviteMemberDto.email && invitation.status === 'pending');
    if (pendingInvitation) {
      throw new ConflictException('There is already a pending invitation for this email');
    }

    // Check account member limits
    const typeConfig = ACCOUNT_TYPE_CONFIG[account.type];
    if (account.members.length >= typeConfig.maxMembers) {
      throw new BadRequestException(`Account has reached the maximum number of members (${typeConfig.maxMembers})`);
    }

    // Validate role for account type
    if (!typeConfig.allowedRoles.includes(inviteMemberDto.role)) {
      throw new BadRequestException(`Role ${inviteMemberDto.role} is not allowed for ${account.type} accounts`);
    }

    // Generate invitation token and expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = {
      email: inviteMemberDto.email,
      role: inviteMemberDto.role,
      invitedBy: userId,
      token,
      expiresAt,
      expenseLimit: inviteMemberDto.expenseLimit || 0
    };

    await this.accountsRepository.addInvitation(accountId, invitation);

    // TODO: Send email invitation (will be implemented in notifications module)

    return {
      message: 'Invitation sent successfully',
      invitationId: token
    };
  }

  async acceptInvitation(token: string, userId: string): Promise<{ message: string; account: AccountResponseDto }> {
    const account = await this.accountsRepository.findByInvitationToken(token);
    if (!account) {
      throw new NotFoundException('Invalid or expired invitation');
    }

    const invitation = account.pendingInvitations.find(inv => inv.token === token);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Check if user is already a member
    const existingMember = account.members.find(member => member.userId.toString() === userId);
    if (existingMember) {
      throw new ConflictException('You are already a member of this account');
    }

    // Add user as member
    await this.accountsRepository.addMember((account as any)._id.toString(), userId, invitation.role, invitation.expenseLimit);

    // Update invitation status
    await this.accountsRepository.updateInvitation((account as any)._id.toString(), token, InvitationStatus.ACCEPTED);

    const updatedAccount = await this.accountsRepository.findById((account as any)._id.toString());
    return {
      message: 'Invitation accepted successfully',
      account: this.mapToResponseDto(updatedAccount!)
    };
  }

  async rejectInvitation(token: string): Promise<{ message: string }> {
    const account = await this.accountsRepository.findByInvitationToken(token);
    if (!account) {
      throw new NotFoundException('Invalid or expired invitation');
    }

    await this.accountsRepository.updateInvitation((account as any)._id.toString(), token, InvitationStatus.REJECTED);

    return { message: 'Invitation rejected successfully' };
  }

  async updateMember(accountId: string, memberId: string, userId: string, updateMemberDto: UpdateMemberDto): Promise<AccountResponseDto> {
    const account = await this.accountsRepository.findById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Check permissions
    if (!this.canManageMembers(account, userId)) {
      throw new ForbiddenException('You do not have permission to update members');
    }

    // Prevent updating owner role
    if (account.owner.toString() === memberId && updateMemberDto.role) {
      throw new BadRequestException('Cannot change the role of the account owner');
    }

    // Validate role for account type if role is being updated
    if (updateMemberDto.role) {
      const typeConfig = ACCOUNT_TYPE_CONFIG[account.type];
      if (!typeConfig.allowedRoles.includes(updateMemberDto.role)) {
        throw new BadRequestException(`Role ${updateMemberDto.role} is not allowed for ${account.type} accounts`);
      }
    }

    const updatedAccount = await this.accountsRepository.updateMember(accountId, memberId, updateMemberDto);

    if (!updatedAccount) {
      throw new NotFoundException('Member not found in account');
    }

    return this.mapToResponseDto(updatedAccount);
  }

  async removeMember(accountId: string, memberId: string, userId: string): Promise<{ message: string }> {
    const account = await this.accountsRepository.findById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Check permissions
    if (!this.canRemoveMembers(account, userId)) {
      throw new ForbiddenException('You do not have permission to remove members');
    }

    // Prevent removing the owner
    if (account.owner.toString() === memberId) {
      throw new BadRequestException('Cannot remove the account owner');
    }

    await this.accountsRepository.removeMember(accountId, memberId);

    return { message: 'Member removed successfully' };
  }

  async getUserRole(accountId: string, userId: string): Promise<AccountRole | null> {
    return this.accountsRepository.findUserRole(accountId, userId);
  }

  async getAccountStats(accountId: string, userId: string) {
    const account = await this.accountsRepository.findById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (!this.hasAccountAccess(account, userId)) {
      throw new ForbiddenException('You do not have access to this account');
    }

    return this.accountsRepository.getAccountStats(accountId);
  }

  // Helper methods
  private hasAccountAccess(account: any, userId: string): boolean {
    return account.owner.toString() === userId || account.members.some((member: any) => member.userId.toString() === userId && member.isActive);
  }

  // Additional helper methods for other services
  async hasUserAccess(accountId: string, userId: string): Promise<boolean> {
    const account = await this.accountsRepository.findById(accountId);
    if (!account) return false;

    return account.owner.toString() === userId || account.members.some(m => m.userId.toString() === userId && m.isActive);
  }

  async findByUser(userId: string): Promise<any[]> {
    return this.accountsRepository.findByUserId(userId);
  }

  async findById(accountId: string): Promise<any> {
    return this.accountsRepository.findById(accountId);
  }

  async isUserAdmin(accountId: string, userId: string): Promise<boolean> {
    const account = await this.accountsRepository.findById(accountId);
    if (!account) return false;

    const userRole = this.getUserRoleFromAccount(account, userId);
    return userRole === AccountRole.OWNER || userRole === AccountRole.BUSINESS_OWNER || userRole === AccountRole.MANAGER;
  }

  private canManageAccount(account: any, userId: string): boolean {
    const userRole = this.getUserRoleFromAccount(account, userId);
    if (!userRole) return false;

    const permissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.includes(Permission.MANAGE_ACCOUNT);
  }

  private canInviteMembers(account: any, userId: string): boolean {
    const userRole = this.getUserRoleFromAccount(account, userId);
    if (!userRole) return false;

    const permissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.includes(Permission.INVITE_MEMBERS);
  }

  private canManageMembers(account: any, userId: string): boolean {
    const userRole = this.getUserRoleFromAccount(account, userId);
    if (!userRole) return false;

    const permissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.includes(Permission.UPDATE_ROLES);
  }

  private canRemoveMembers(account: any, userId: string): boolean {
    const userRole = this.getUserRoleFromAccount(account, userId);
    if (!userRole) return false;

    const permissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.includes(Permission.REMOVE_MEMBERS);
  }

  private getUserRoleFromAccount(account: any, userId: string): AccountRole | null {
    if (account.owner.toString() === userId) {
      return AccountRole.OWNER;
    }

    const member = account.members.find((m: any) => m.userId.toString() === userId && m.isActive);

    return member?.role || null;
  }

  private mapToResponseDto(account: any): AccountResponseDto {
    const typeConfig = ACCOUNT_TYPE_CONFIG[account.type];

    return {
      id: account._id.toString(),
      name: account.name,
      type: account.type,
      status: account.status,
      owner: account.owner._id?.toString() || account.owner.toString(),
      members: account.members.map((member: any) => ({
        userId: member.userId._id?.toString() || member.userId.toString(),
        userEmail: member.userId.email || 'Unknown',
        userName: `${member.userId.firstName || ''} ${member.userId.lastName || ''}`.trim() || 'Unknown',
        role: member.role,
        joinedAt: member.joinedAt,
        isActive: member.isActive,
        expenseLimit: member.expenseLimit,
        permissions: ROLE_PERMISSIONS[member.role] || []
      })),
      pendingInvitations: account.pendingInvitations.map((invitation: any) => ({
        id: invitation._id?.toString() || invitation.token,
        email: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invitedBy.email || invitation.invitedBy.toString(),
        invitedAt: invitation.invitedAt,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
        expenseLimit: invitation.expenseLimit
      })),
      currency: account.currency,
      timezone: account.timezone,
      description: account.description,
      privacySettings: account.privacySettings || DEFAULT_PRIVACY_SETTINGS[account.type],
      preferences: account.preferences || {},
      lastActivityAt: account.lastActivityAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      memberCount: account.members.filter((m: any) => m.isActive).length,
      features: typeConfig.features
    };
  }
}
