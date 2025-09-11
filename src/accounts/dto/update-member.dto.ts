import {IsBoolean, IsEnum, IsNumber, IsOptional, Max, Min} from 'class-validator';
import {ApiPropertyOptional} from '@nestjs/swagger';
import {AccountRole} from '@common/constants/user-roles';

export class UpdateMemberDto {
  @ApiPropertyOptional({description: 'New role for the member', enum: AccountRole, example: AccountRole.MANAGER})
  @IsOptional()
  @IsEnum(AccountRole)
  role?: AccountRole;

  @ApiPropertyOptional({description: 'New expense limit for the member (0 means no limit)', example: 2000, minimum: 0, maximum: 1000000})
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  expenseLimit?: number;

  @ApiPropertyOptional({description: 'Active status of the member', example: true})
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
