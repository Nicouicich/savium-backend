import { PartialType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  firstName?: string;

  @IsOptional()
  lastName?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  dateOfBirth?: string;

  @IsOptional()
  timezone?: string;

  @IsOptional()
  locale?: string;

  @IsOptional()
  preferences?: any;

  // Note: email, password, and role are excluded from updates
  // They require separate endpoints for security
}
