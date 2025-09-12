import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCategoryDto extends PartialType(OmitType(CreateCategoryDto, ['name'] as const)) {
  @ApiPropertyOptional({ description: 'Whether the category is active', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether the category is visible to users', example: true })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
