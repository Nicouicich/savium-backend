import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePersonalInfoDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 2,
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(50, { message: 'First name must be less than 50 characters' })
  firstName?: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: 2,
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(50, { message: 'Last name must be less than 50 characters' })
  lastName?: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com'
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email?: string;
}

export class PersonalInfoResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data: {
    user: any;
  };

  @ApiProperty()
  timestamp: string;
}
