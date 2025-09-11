import {ApiProperty} from '@nestjs/swagger';
import {IsString, MinLength, MaxLength, Matches} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123!',
    minLength: 8,
    maxLength: 128
  })
  @IsString({message: 'Current password must be a string'})
  @MinLength(8, {
    message: 'Current password must be at least 8 characters long'
  })
  @MaxLength(128, {message: 'Current password cannot exceed 128 characters'})
  currentPassword: string;

  @ApiProperty({
    description: 'New password - must contain at least 8 characters, including uppercase, lowercase, number and special character',
    example: 'NewSecurePassword123!',
    minLength: 8,
    maxLength: 128
  })
  @IsString({message: 'New password must be a string'})
  @MinLength(8, {message: 'New password must be at least 8 characters long'})
  @MaxLength(128, {message: 'New password cannot exceed 128 characters'})
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  newPassword: string;
}
