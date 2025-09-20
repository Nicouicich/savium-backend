import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsString } from 'class-validator';

export enum BulkOperationType {
  DELETE = 'delete',
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate'
}

export class BulkCategoryOperationDto {
  @ApiProperty({
    description: 'Bulk operation type',
    enum: BulkOperationType,
    example: BulkOperationType.DELETE
  })
  @IsEnum(BulkOperationType, { message: 'Operation must be one of: delete, activate, deactivate' })
  operation: BulkOperationType;

  @ApiProperty({
    description: 'Array of category IDs to perform operation on',
    type: [String],
    example: ['category-1-id', 'category-2-id']
  })
  @IsArray({ message: 'categoryIds must be an array' })
  @ArrayNotEmpty({ message: 'categoryIds cannot be empty' })
  @IsString({ each: true, message: 'Each category ID must be a string' })
  categoryIds: string[];
}

export class BulkOperationResultDto {
  @ApiProperty({
    description: 'Number of successfully processed categories',
    example: 3
  })
  success: number;

  @ApiProperty({
    description: 'Number of categories that failed to process',
    example: 1
  })
  failed: number;

  @ApiProperty({
    description: 'Details of failed operations',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        categoryId: { type: 'string' },
        error: { type: 'string' }
      }
    },
    example: [
      {
        categoryId: 'category-3-id',
        error: 'Category not found'
      }
    ],
    required: false
  })
  errors?: Array<{ categoryId: string; error: string }>;
}
