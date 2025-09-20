import { UserRole } from '@common/constants/user-roles';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  @Expose()
  @Transform(({ obj }) => obj._id || obj.id)
  id: string;

  @ApiProperty({ description: 'First name' })
  @Expose()
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  @Expose()
  lastName: string;

  @ApiProperty({ description: 'Full name' })
  @Expose()
  @Transform(({ obj }) => `${obj.firstName} ${obj.lastName}`)
  fullName: string;

  @ApiProperty({ description: 'Email address' })
  @Expose()
  email: string;

  @ApiProperty({ description: 'User role', enum: UserRole })
  @Expose()
  role: UserRole;

  @ApiProperty({ description: 'Account active status' })
  @Expose()
  isActive: boolean;

  @ApiProperty({ description: 'Email verification status' })
  @Expose()
  isEmailVerified: boolean;

  @ApiProperty({ description: 'Avatar URL', required: false })
  @Expose()
  avatar?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @Expose()
  phone?: string;

  @ApiProperty({ description: 'Date of birth', required: false })
  @Expose()
  dateOfBirth?: Date;

  @ApiProperty({ description: 'Timezone', required: false })
  @Expose()
  timezone?: string;

  @ApiProperty({ description: 'Locale', required: false })
  @Expose()
  locale?: string;

  @ApiProperty({ description: 'User preferences' })
  @Expose()
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    privacy: {
      profileVisibility: 'public' | 'private';
      activityVisibility: 'public' | 'friends' | 'private';
    };
    display: {
      currency: string;
      language: string;
      theme: 'light' | 'dark' | 'auto';
    };
  };

  @ApiProperty({ description: 'Account IDs associated with user' })
  @Expose()
  accounts: string[];

  @ApiProperty({ description: 'Last login timestamp' })
  @Expose()
  lastLoginAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @Expose()
  updatedAt: Date;
}
