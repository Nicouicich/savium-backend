import { TransactionCategory } from '@common/constants/transaction-categories';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
    example: 'Food & Dining',
    minLength: 1,
    maxLength: 50
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

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
}
