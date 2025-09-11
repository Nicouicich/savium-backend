import {IsEmail, IsEnum, IsNumber, IsOptional, IsString, Max, Min} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {AccountRole} from '@common/constants/user-roles';

export class InviteMemberDto {
  @ApiProperty({description: 'Email address of the user to invite', example: 'john.doe@example.com'})
  @IsEmail()
  email: string;

  @ApiProperty({description: 'Role to assign to the invited member', enum: AccountRole, example: AccountRole.EMPLOYEE})
  @IsEnum(AccountRole)
  role: AccountRole;

  @ApiPropertyOptional({description: 'Expense limit for the member (0 means no limit)', example: 1000, minimum: 0, maximum: 1000000})
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  expenseLimit?: number;

  @ApiPropertyOptional({description: 'Personal message for the invitation', example: 'Welcome to our family expense account!'})
  @IsOptional()
  @IsString()
  message?: string;
}
