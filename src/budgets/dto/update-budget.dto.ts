import { OmitType, PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { BudgetStatus } from '../schemas/budget.schema';
import { CreateBudgetDto } from './create-budget.dto';

export class UpdateBudgetDto extends PartialType(OmitType(CreateBudgetDto, ['accountId'] as const)) {
  @ApiPropertyOptional({ description: 'Budget status', enum: BudgetStatus, example: BudgetStatus.ACTIVE })
  @IsOptional()
  @IsEnum(BudgetStatus)
  status?: BudgetStatus;
}
