import {ApiProperty} from '@nestjs/swagger';
import {IsEmail, IsString, MaxLength, MinLength, Matches} from 'class-validator';
import {Transform} from 'class-transformer';

export class RegisterDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 2,
    maxLength: 50
  })
  @IsString({message: 'First name must be a string'})
  @MinLength(2, {message: 'First name must be at least 2 characters long'})
  @MaxLength(50, {message: 'First name must not exceed 50 characters'})
  @Matches(/^[a-zA-Z\s\-']+$/, {message: 'First name contains invalid characters'})
  @Transform(({value}) => value?.trim())
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: 2,
    maxLength: 50
  })
  @IsString({message: 'Last name must be a string'})
  @MinLength(2, {message: 'Last name must be at least 2 characters long'})
  @MaxLength(50, {message: 'Last name must not exceed 50 characters'})
  @Matches(/^[a-zA-Z\s\-']+$/, {message: 'Last name contains invalid characters'})
  @Transform(({value}) => value?.trim())
  lastName: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com'
  })
  @IsEmail({}, {message: 'Please provide a valid email address'})
  @Transform(({value}) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({
    description: 'User password - must contain at least 8 characters, including uppercase, lowercase, number and special character',
    example: 'SecurePassword123!',
    minLength: 8
  })
  @IsString({message: 'Password must be a string'})
  @MinLength(8, {message: 'Password must be at least 8 characters long'})
  @MaxLength(128, {message: 'Password must not exceed 128 characters'})
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  password: string;
}
