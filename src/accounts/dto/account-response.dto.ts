import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountStatus, AccountType } from '@common/constants/account-types';
import { AccountRole } from '@common/constants/user-roles';

export class AccountMemberResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'User email' })
  userEmail: string;

  @ApiProperty({ description: 'User full name' })
  userName: string;

  @ApiProperty({ enum: AccountRole, description: 'Member role' })
  role: AccountRole;

  @ApiProperty({ description: 'Date when member joined' })
  joinedAt: Date;

  @ApiProperty({ description: 'Whether member is active' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Transaction limit for member' })
  transactionLimit?: number;

  @ApiProperty({ description: 'Member permissions', type: [String] })
  permissions: string[];
}

export class AccountInvitationResponseDto {
  @ApiProperty({ description: 'Invitation ID' })
  id: string;

  @ApiProperty({ description: 'Invited email' })
  email: string;

  @ApiProperty({ enum: AccountRole, description: 'Invited role' })
  role: AccountRole;

  @ApiProperty({ description: 'Who sent the invitation' })
  invitedBy: string;

  @ApiProperty({ description: 'Invitation date' })
  invitedAt: Date;

  @ApiProperty({ description: 'Invitation expiry date' })
  expiresAt: Date;

  @ApiProperty({ description: 'Invitation status' })
  status: string;

  @ApiPropertyOptional({ description: 'Transaction limit for invited member' })
  transactionLimit?: number;
}

export class AccountResponseDto {
  @ApiProperty({ description: 'Account ID' })
  id: string;

  @ApiProperty({ description: 'Account name' })
  name: string;

  @ApiProperty({ enum: AccountType, description: 'Account type' })
  type: AccountType;

  @ApiProperty({ enum: AccountStatus, description: 'Account status' })
  status: AccountStatus;

  @ApiProperty({ description: 'Account owner ID' })
  owner: string;

  @ApiProperty({ type: [AccountMemberResponseDto], description: 'Account members' })
  members: AccountMemberResponseDto[];

  @ApiProperty({ type: [AccountInvitationResponseDto], description: 'Pending invitations' })
  pendingInvitations: AccountInvitationResponseDto[];

  @ApiProperty({ description: 'Account currency' })
  currency: string;

  @ApiPropertyOptional({ description: 'Account timezone' })
  timezone?: string;

  @ApiPropertyOptional({ description: 'Account description' })
  description?: string;

  @ApiProperty({ description: 'Privacy settings', type: 'object' })
  privacySettings: {
    transactionVisibility: string;
    reportVisibility: string;
    budgetVisibility: string;
    allowPrivateTransactions?: boolean;
    childTransactionLimit?: number;
    requireApproval?: boolean;
    approvalThreshold?: number;
  };

  @ApiProperty({ description: 'Account preferences', type: 'object' })
  preferences: Record<string, any>;

  @ApiProperty({ description: 'Last activity date' })
  lastActivityAt: Date;

  @ApiProperty({ description: 'Account creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Account update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Member count' })
  memberCount: number;

  @ApiProperty({ description: 'Available features', type: [String] })
  features: string[];
}
