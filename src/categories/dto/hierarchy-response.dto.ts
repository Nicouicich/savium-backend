import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory } from '@common/constants/expense-categories';
import { SubcategoryResponseDto } from './category-response.dto';

export class CategoryHierarchyResponseDto {
  @ApiProperty({ description: 'Category ID' })
  id: string;

  @ApiProperty({ description: 'Category internal name' })
  name: string;

  @ApiProperty({ description: 'Category display name' })
  displayName: string;

  @ApiPropertyOptional({ enum: ExpenseCategory, description: 'Predefined category type' })
  type?: ExpenseCategory;

  @ApiProperty({ description: 'Category icon' })
  icon: string;

  @ApiProperty({ description: 'Category color' })
  color: string;

  @ApiPropertyOptional({ description: 'Category description' })
  description?: string;

  @ApiProperty({
    type: [SubcategoryResponseDto],
    description: 'Category subcategories with full details'
  })
  subcategories: SubcategoryResponseDto[];

  @ApiPropertyOptional({ description: 'Account ID (null for global categories)' })
  accountId?: string;

  @ApiPropertyOptional({ description: 'Category creator ID' })
  createdBy?: string;

  @ApiProperty({ description: 'Whether this is a custom category' })
  isCustom: boolean;

  @ApiProperty({ description: 'Whether the category is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Whether the category is visible' })
  isVisible: boolean;

  @ApiProperty({
    type: [String],
    description: 'Keywords for AI categorization'
  })
  keywords: string[];

  @ApiProperty({ description: 'Sort order' })
  sortOrder: number;

  @ApiProperty({ description: 'Number of subcategories' })
  subcategoryCount: number;

  @ApiProperty({ description: 'Whether category can be edited' })
  canEdit: boolean;

  @ApiProperty({ description: 'Whether category can be deleted' })
  canDelete: boolean;

  @ApiProperty({ description: 'Category creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Category update date' })
  updatedAt: Date;
}
