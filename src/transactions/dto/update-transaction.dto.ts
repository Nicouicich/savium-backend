import { OmitType, PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

export class UpdateTransactionDto extends PartialType(OmitType(CreateTransactionDto, ['profileId'] as const)) {
  @ApiPropertyOptional({
    description: 'Whether transaction needs review',
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
    description: 'Transaction status',
    enum: ['active', 'pending_approval', 'approved', 'rejected'],
    example: 'active'
  })
  @IsOptional()
  @IsString()
  status?: 'active' | 'pending_approval' | 'approved' | 'rejected';

  @ApiPropertyOptional({
    description: 'Whether transaction is flagged',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isFlagged?: boolean;

  @ApiPropertyOptional({
    description: 'Reason for flagging',
    example: 'Duplicate transaction detected'
  })
  @IsOptional()
  @IsString()
  flagReason?: string;
}
