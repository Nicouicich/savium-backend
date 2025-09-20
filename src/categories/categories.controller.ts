import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CategoriesService } from './categories.service';
import {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryHierarchyResponseDto,
  BulkCategoryOperationDto,
  BulkOperationResultDto
} from './dto';

import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponseDto } from '@common/decorators/api-response.decorator';
import { TransactionCategory } from '@common/constants/transaction-categories';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponseDto(CategoryResponseDto, 201, 'Category created successfully')
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Category name already exists' })
  @ApiQuery({
    name: 'accountId',
    required: false,
    description: 'Account ID (if not provided, creates global category)'
  })
  async create(
    @Body(ValidationPipe) createCategoryDto: CreateCategoryDto,
    @CurrentUser('id') userId: string,
    @Query('accountId') accountId?: string
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(createCategoryDto, accountId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponseDto([CategoryResponseDto], 200, 'Categories retrieved successfully')
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  @ApiQuery({
    name: 'includeGlobal',
    required: false,
    type: Boolean,
    description: 'Include global categories (default: true)'
  })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('accountId') accountId?: string,
    @Query('includeGlobal') includeGlobal?: boolean
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll(accountId, userId, includeGlobal !== false);
  }

  @Get('hierarchy')
  @ApiOperation({
    summary: 'Get categories in hierarchical structure',
    description: 'Returns categories with their subcategories in a hierarchical format for tree views'
  })
  @ApiResponseDto([CategoryHierarchyResponseDto], 200, 'Category hierarchy retrieved successfully')
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  @ApiQuery({
    name: 'includeGlobal',
    required: false,
    type: Boolean,
    description: 'Include global categories (default: true)'
  })
  async getHierarchy(
    @CurrentUser('id') userId: string,
    @Query('accountId') accountId?: string,
    @Query('includeGlobal') includeGlobal?: boolean
  ): Promise<CategoryHierarchyResponseDto[]> {
    return this.categoriesService.findAllHierarchy(accountId, userId, includeGlobal !== false);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Perform bulk operations on categories',
    description: 'Execute bulk operations like delete, activate, or deactivate on multiple categories'
  })
  @ApiResponseDto(BulkOperationResultDto, 200, 'Bulk operation completed')
  @ApiResponse({ status: 400, description: 'Invalid operation or category IDs' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  async bulkOperation(
    @Body(ValidationPipe) bulkDto: BulkCategoryOperationDto,
    @CurrentUser('id') userId: string,
    @Query('accountId') accountId?: string
  ): Promise<BulkOperationResultDto> {
    return this.categoriesService.bulkOperation(bulkDto, accountId, userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search categories' })
  @ApiResponseDto([CategoryResponseDto], 200, 'Categories found')
  @ApiQuery({ name: 'q', description: 'Search term' })
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  async search(@Query('q') searchTerm: string, @CurrentUser('id') userId: string, @Query('accountId') accountId?: string): Promise<CategoryResponseDto[]> {
    return this.categoriesService.searchCategories(searchTerm, accountId, userId);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get categories by type' })
  @ApiParam({
    name: 'type',
    enum: TransactionCategory,
    description: 'Category type'
  })
  @ApiResponseDto([CategoryResponseDto], 200, 'Categories retrieved successfully')
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  async findByType(
    @Param('type') type: TransactionCategory,
    @CurrentUser('id') userId: string,
    @Query('accountId') accountId?: string
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.getCategoriesByType(type, accountId, userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get category statistics' })
  @ApiResponse({
    status: 200,
    description: 'Category statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        custom: { type: 'number' },
        global: { type: 'number' },
        active: { type: 'number' },
        inactive: { type: 'number' }
      }
    }
  })
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  async getStats(@CurrentUser('id') userId: string, @Query('accountId') accountId?: string) {
    return this.categoriesService.getStats(accountId, userId);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular categories' })
  @ApiResponse({
    status: 200,
    description: 'Popular categories retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          categoryId: { type: 'string' },
          name: { type: 'string' },
          displayName: { type: 'string' },
          usageCount: { type: 'number' }
        }
      }
    }
  })
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of categories to return (default: 10)'
  })
  async getPopular(@CurrentUser('id') userId: string, @Query('accountId') accountId?: string, @Query('limit') limit?: number) {
    return this.categoriesService.getPopularCategories(accountId, userId, limit ? parseInt(limit.toString()) : 10);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponseDto(CategoryResponseDto, 200, 'Category retrieved successfully')
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  async findOne(@Param('id') id: string, @CurrentUser('id') userId: string, @Query('accountId') accountId?: string): Promise<CategoryResponseDto> {
    return this.categoriesService.findOne(id, userId, accountId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponseDto(CategoryResponseDto, 200, 'Category updated successfully')
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateCategoryDto: UpdateCategoryDto,
    @CurrentUser('id') userId: string,
    @Query('accountId') accountId?: string
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(id, updateCategoryDto, userId, accountId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string, @Query('accountId') accountId?: string): Promise<{ message: string }> {
    await this.categoriesService.remove(id, userId, accountId);
    return { message: 'Category deleted successfully' };
  }

  @Post(':id/subcategories')
  @ApiOperation({ summary: 'Add subcategory to category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 201, description: 'Subcategory added successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Subcategory already exists' })
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  async addSubcategory(
    @Param('id') categoryId: string,
    @Body(ValidationPipe)
    subcategory: {
      name: string;
      displayName: string;
      description?: string;
      isActive?: boolean;
    },
    @CurrentUser('id') userId: string,
    @Query('accountId') accountId?: string
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.addSubcategory(categoryId, subcategory, userId, accountId);
  }

  @Patch(':id/subcategories/:subcategoryName')
  @ApiOperation({ summary: 'Update subcategory' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiParam({ name: 'subcategoryName', description: 'Subcategory name' })
  @ApiResponse({ status: 200, description: 'Subcategory updated successfully' })
  @ApiResponse({
    status: 404,
    description: 'Category or subcategory not found'
  })
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  async updateSubcategory(
    @Param('id') categoryId: string,
    @Param('subcategoryName') subcategoryName: string,
    @Body(ValidationPipe)
    updates: {
      displayName?: string;
      description?: string;
      isActive?: boolean;
    },
    @CurrentUser('id') userId: string,
    @Query('accountId') accountId?: string
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.updateSubcategory(categoryId, subcategoryName, updates, userId, accountId);
  }

  @Delete(':id/subcategories/:subcategoryName')
  @ApiOperation({ summary: 'Remove subcategory from category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiParam({ name: 'subcategoryName', description: 'Subcategory name' })
  @ApiResponse({ status: 200, description: 'Subcategory removed successfully' })
  @ApiResponse({
    status: 404,
    description: 'Category or subcategory not found'
  })
  @ApiQuery({ name: 'accountId', required: false, description: 'Account ID' })
  async removeSubcategory(
    @Param('id') categoryId: string,
    @Param('subcategoryName') subcategoryName: string,
    @CurrentUser('id') userId: string,
    @Query('accountId') accountId?: string
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.removeSubcategory(categoryId, subcategoryName, userId, accountId);
  }
}
