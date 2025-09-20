import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionCategory } from '@common/constants/transaction-categories';

export class CreateSubcategoryDto {
  @ApiProperty({
    description: 'Subcategory internal name',
    example: 'restaurant'
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'Subcategory display name',
    example: 'Restaurant'
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;

  @ApiPropertyOptional({ description: 'Subcategory description', example: 'Transactions at restaurants and dining establishments' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the subcategory is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category internal name (unique within account)',
    example: 'food_dining',
    minLength: 1,
    maxLength: 50
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'Category display name',
    example: 'Food & Dining',
    minLength: 1,
    maxLength: 100
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;

  @ApiPropertyOptional({ description: 'Predefined category type', enum: TransactionCategory, example: TransactionCategory.FOOD_DINING })
  @IsOptional()
  @IsEnum(TransactionCategory)
  type?: TransactionCategory;

  @ApiProperty({
    description: 'Category icon (emoji or icon identifier)',
    example: '🍽️'
  })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  icon: string;

  @ApiProperty({
    description: 'Category color (hex format)',
    example: '#FF6B6B'
  })
  @IsString()
  @MinLength(4)
  @MaxLength(7)
  color: string;

  @ApiPropertyOptional({ description: 'Category description', example: 'All transactions related to food, dining, and groceries', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'List of subcategories', type: [CreateSubcategoryDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  subcategories?: CreateSubcategoryDto[];

  @ApiPropertyOptional({ description: 'Keywords for AI categorization', type: [String], example: ['restaurant', 'food', 'dining', 'grocery'], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  keywords?: string[];

  @ApiPropertyOptional({ description: 'Sort order for display', example: 1, minimum: 0, maximum: 999 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'AI configuration for categorization', type: 'object' })
  @IsOptional()
  aiConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object' })
  @IsOptional()
  metadata?: Record<string, any>;
}
