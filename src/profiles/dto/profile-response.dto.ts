import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProfileType } from 'src/financial-profiles/schemas';

export class ProfileResponseDto {
  @ApiProperty({ description: 'Profile ID' })
  id: string;

  @ApiProperty({ description: 'User ID who owns the profile' })
  userId: string;

  @ApiProperty({ description: 'Profile type', enum: ProfileType })
  type: ProfileType;

  @ApiProperty({ description: 'Profile name' })
  name: string;

  @ApiPropertyOptional({ description: 'Profile description' })
  description?: string;

  @ApiProperty({ description: 'Profile currency' })
  currency: string;

  @ApiProperty({ description: 'Profile timezone' })
  timezone: string;

  @ApiProperty({ description: 'Profile settings', type: 'object' })
  settings: {
    privacy?: {
      transactionVisibility?: 'private' | 'members_only' | 'public';
      reportVisibility?: 'private' | 'members_only' | 'public';
      budgetVisibility?: 'private' | 'members_only' | 'public';
      allowPrivateTransactions?: boolean;
      childTransactionLimit?: number;
      requireApproval?: boolean;
      approvalThreshold?: number;
    };
    notifications?: {
      enabled?: boolean;
      frequency?: 'instant' | 'daily' | 'weekly' | 'monthly';
      channels?: ('email' | 'whatsapp' | 'telegram' | 'push')[];
    };
    preferences?: {
      dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY';
      timeFormat?: '12h' | '24h';
      weekStartDay?: 'sunday' | 'monday';
      autoCategorizationEnabled?: boolean;
      receiptScanningEnabled?: boolean;
    };
  };

  @ApiProperty({ description: 'Profile members', type: [String] })
  members: string[];

  @ApiProperty({ description: 'Profile status' })
  status: 'active' | 'inactive' | 'archived';

  @ApiProperty({ description: 'Total number of members including owner' })
  totalMembers: number;

  @ApiProperty({ description: 'Whether this is a personal profile' })
  isPersonal: boolean;

  @ApiProperty({ description: 'Whether this is a shared profile' })
  isShared: boolean;

  @ApiProperty({ description: 'Last time profile was used' })
  lastUsedAt: Date;

  @ApiProperty({ description: 'Profile creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Profile last update date' })
  updatedAt: Date;
}
