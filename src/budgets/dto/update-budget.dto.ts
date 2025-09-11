import {OmitType, PartialType} from '@nestjs/swagger';
import {IsEnum, IsOptional} from 'class-validator';
import {ApiPropertyOptional} from '@nestjs/swagger';
import {CreateBudgetDto} from './create-budget.dto';
import {BudgetStatus} from '../schemas/budget.schema';

export class UpdateBudgetDto extends PartialType(OmitType(CreateBudgetDto, ['accountId'] as const)) {
  @ApiPropertyOptional({description: 'Budget status', enum: BudgetStatus, example: BudgetStatus.ACTIVE})
  @IsOptional()
  @IsEnum(BudgetStatus)
  status?: BudgetStatus;
}
