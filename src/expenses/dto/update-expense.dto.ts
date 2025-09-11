import {OmitType, PartialType} from '@nestjs/swagger';
import {IsBoolean, IsOptional, IsString} from 'class-validator';
import {ApiPropertyOptional} from '@nestjs/swagger';
import {CreateExpenseDto} from './create-expense.dto';

export class UpdateExpenseDto extends PartialType(OmitType(CreateExpenseDto, ['accountId'] as const)) {
  @ApiPropertyOptional({
    description: 'Whether expense needs review',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;

  @ApiPropertyOptional({
    description: 'Reason for review if needed',
    example: 'Unusual amount for this category'
  })
  @IsOptional()
  @IsString()
  reviewReason?: string;

  @ApiPropertyOptional({
    description: 'Expense status',
    enum: ['active', 'pending_approval', 'approved', 'rejected'],
    example: 'active'
  })
  @IsOptional()
  @IsString()
  status?: 'active' | 'pending_approval' | 'approved' | 'rejected';

  @ApiPropertyOptional({
    description: 'Whether expense is flagged',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isFlagged?: boolean;

  @ApiPropertyOptional({
    description: 'Reason for flagging',
    example: 'Duplicate expense detected'
  })
  @IsOptional()
  @IsString()
  flagReason?: string;
}
