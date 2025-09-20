import { OmitType, PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { GoalStatus } from '../schemas/goal.schema';
import { CreateGoalDto } from './create-goal.dto';

export class UpdateGoalDto extends PartialType(OmitType(CreateGoalDto, ['profileId'] as const)) {
  @ApiPropertyOptional({
    description: 'Goal status',
    enum: GoalStatus,
    example: GoalStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @ApiPropertyOptional({
    description: 'Update current progress amount (additive)',
    example: 100.0,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  addToProgress?: number;

  @ApiPropertyOptional({
    description: 'Set current progress amount (absolute)',
    example: 2600.0,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  setProgress?: number;
}
