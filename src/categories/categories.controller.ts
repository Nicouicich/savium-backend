import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CategoriesService } from './categories.service';
import {
  BulkCategoryOperationDto,
  BulkOperationResultDto,
  CategoryHierarchyResponseDto,
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto
} from './dto';

import { TransactionCategory } from '@common/constants/transaction-categories';
import { ApiResponseDto } from '@common/decorators/api-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}
}
