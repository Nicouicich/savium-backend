import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CategoriesRepository } from './categories.repository';
import { AccountsService } from '../accounts/accounts.service';
import {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryHierarchyResponseDto,
  BulkCategoryOperationDto,
  BulkOperationResultDto,
  BulkOperationType
} from './dto';

import { CATEGORY_CONFIG, CATEGORY_KEYWORDS, ExpenseCategory } from '@common/constants/expense-categories';
import { AccountRole, Permission, ROLE_PERMISSIONS } from '@common/constants/user-roles';
import { EnhancedCacheService } from '@common/services/enhanced-cache.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly accountsService: AccountsService,
    private readonly configService: ConfigService,
    private readonly cacheService: EnhancedCacheService
  ) {}

  async create(createCategoryDto: CreateCategoryDto, accountId?: string, userId?: string): Promise<CategoryResponseDto> {
    // Check if user has permission to create categories for the account
    if (accountId && userId) {
      const userRole = await this.accountsService.getUserRole(accountId, userId);
      if (!userRole || !this.canCreateCategories(userRole)) {
        throw new ForbiddenException('You do not have permission to create categories');
      }
    }

    // Check if category name already exists for the account/global
    const existingCategory = await this.categoriesRepository.findByName(createCategoryDto.name, accountId);
    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    // Validate category type if provided
    if (createCategoryDto.type && !Object.values(ExpenseCategory).includes(createCategoryDto.type)) {
      throw new BadRequestException('Invalid category type');
    }

    // Set default values
    const categoryData = {
      ...createCategoryDto,
      sortOrder: createCategoryDto.sortOrder ?? 999,
      keywords: createCategoryDto.keywords || [],
      subcategories: createCategoryDto.subcategories || []
    };

    const category = await this.categoriesRepository.create(categoryData, accountId, userId);

    // Invalidate relevant caches
    if (accountId) {
      await this.cacheService.invalidateAccountCache(accountId);
    }
    await this.cacheService.delete('categories:global', 'categories');
    await this.cacheService.delete('categories:all', 'categories');

    return this.mapToResponseDto(category, userId);
  }

  async findAll(accountId?: string, userId?: string, includeGlobal = true): Promise<CategoryResponseDto[]> {
    // Check if user has access to the account
    if (accountId && userId) {
      try {
        await this.accountsService.findOne(accountId, userId);
      } catch (error) {
        throw new ForbiddenException('You do not have access to this account');
      }
    }

    // Create cache key based on parameters
    const cacheKey = accountId ? `categories:account:${accountId}:global:${includeGlobal}` : 'categories:global';

    // Try to get from cache first
    const cached = await this.cacheService.cacheQuery(
      cacheKey,
      async () => {
        const categories = await this.categoriesRepository.findAll(accountId, includeGlobal);
        return categories.map(category => this.mapToResponseDto(category, userId));
      },
      {
        ttl: 1800, // 30 minutes for category lists
        namespace: 'categories',
        tags: accountId ? [`account:${accountId}`, 'categories'] : ['categories']
      }
    );

    return cached;
  }

  async findOne(id: string, userId?: string, accountId?: string): Promise<CategoryResponseDto> {
    // Cache individual category lookups
    const cacheKey = `category:${id}`;

    const cached = await this.cacheService.cacheQuery(
      cacheKey,
      async () => {
        const category = await this.categoriesRepository.findById(id);
        if (!category) {
          return null;
        }
        return category;
      },
      {
        ttl: 3600, // 1 hour for individual categories
        namespace: 'categories',
        tags: ['categories']
      }
    );

    if (!cached) {
      throw new NotFoundException('Category not found');
    }

    // Check access permissions
    if (cached.accountId && accountId) {
      if (cached.accountId.toString() !== accountId) {
        throw new ForbiddenException('You do not have access to this category');
      }

      if (userId) {
        try {
          await this.accountsService.findOne(accountId, userId);
        } catch (error) {
          throw new ForbiddenException('You do not have access to this account');
        }
      }
    }

    return this.mapToResponseDto(cached, userId);
  }

  // Public method for other services
  async findById(id: string): Promise<any> {
    const cacheKey = `category:${id}`;

    return this.cacheService.cacheQuery(cacheKey, async () => this.categoriesRepository.findById(id), {
      ttl: 3600, // 1 hour for individual categories
      namespace: 'categories',
      tags: ['categories']
    });
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto, userId?: string, accountId?: string): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check permissions
    if (category.accountId && accountId && userId) {
      if (category.accountId.toString() !== accountId) {
        throw new ForbiddenException('You do not have access to this category');
      }

      const userRole = await this.accountsService.getUserRole(accountId, userId);
      if (!userRole || !this.canEditCategories(userRole)) {
        throw new ForbiddenException('You do not have permission to edit categories');
      }
    } else if (!category.accountId) {
      // Global categories can only be updated by system admins
      throw new ForbiddenException('Cannot modify global categories');
    }

    const updatedCategory = await this.categoriesRepository.update(id, updateCategoryDto);
    if (!updatedCategory) {
      throw new NotFoundException('Category not found');
    }

    // Invalidate relevant caches
    await this.cacheService.delete(`category:${id}`, 'categories');
    if (accountId) {
      await this.cacheService.invalidateAccountCache(accountId);
    }
    await this.cacheService.invalidateByTags(['categories']);

    return this.mapToResponseDto(updatedCategory, userId);
  }

  async remove(id: string, userId?: string, accountId?: string): Promise<void> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check permissions
    if (category.accountId && accountId && userId) {
      if (category.accountId.toString() !== accountId) {
        throw new ForbiddenException('You do not have access to this category');
      }

      const userRole = await this.accountsService.getUserRole(accountId, userId);
      if (!userRole || !this.canDeleteCategories(userRole)) {
        throw new ForbiddenException('You do not have permission to delete categories');
      }
    } else if (!category.accountId) {
      // Global categories cannot be deleted
      throw new ForbiddenException('Cannot delete global categories');
    }

    // TODO: Check if category is being used by any expenses
    // If used, prevent deletion or offer to soft delete

    await this.categoriesRepository.softDelete(id);

    // Invalidate relevant caches
    await this.cacheService.delete(`category:${id}`, 'categories');
    if (accountId) {
      await this.cacheService.invalidateAccountCache(accountId);
    }
    await this.cacheService.invalidateByTags(['categories']);
  }

  async addSubcategory(
    categoryId: string,
    subcategory: {
      name: string;
      displayName: string;
      description?: string;
      isActive?: boolean;
    },
    userId?: string,
    accountId?: string
  ): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check permissions
    if (category.accountId && accountId && userId) {
      const userRole = await this.accountsService.getUserRole(accountId, userId);
      if (!userRole || !this.canEditCategories(userRole)) {
        throw new ForbiddenException('You do not have permission to edit categories');
      }
    }

    // Check if subcategory already exists
    const existingSubcategory = category.subcategories.find(sub => sub.name === subcategory.name);
    if (existingSubcategory) {
      throw new ConflictException('Subcategory with this name already exists');
    }

    const updatedCategory = await this.categoriesRepository.addSubcategory(categoryId, subcategory);

    if (!updatedCategory) {
      throw new NotFoundException('Category not found');
    }

    return this.mapToResponseDto(updatedCategory, userId);
  }

  async updateSubcategory(
    categoryId: string,
    subcategoryName: string,
    updates: {
      displayName?: string;
      description?: string;
      isActive?: boolean;
    },
    userId?: string,
    accountId?: string
  ): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check permissions (similar to update category)
    if (category.accountId && accountId && userId) {
      const userRole = await this.accountsService.getUserRole(accountId, userId);
      if (!userRole || !this.canEditCategories(userRole)) {
        throw new ForbiddenException('You do not have permission to edit categories');
      }
    }

    const updatedCategory = await this.categoriesRepository.updateSubcategory(categoryId, subcategoryName, updates);

    if (!updatedCategory) {
      throw new NotFoundException('Category or subcategory not found');
    }

    return this.mapToResponseDto(updatedCategory, userId);
  }

  async removeSubcategory(categoryId: string, subcategoryName: string, userId?: string, accountId?: string): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check permissions
    if (category.accountId && accountId && userId) {
      const userRole = await this.accountsService.getUserRole(accountId, userId);
      if (!userRole || !this.canEditCategories(userRole)) {
        throw new ForbiddenException('You do not have permission to edit categories');
      }
    }

    const updatedCategory = await this.categoriesRepository.removeSubcategory(categoryId, subcategoryName);

    if (!updatedCategory) {
      throw new NotFoundException('Category not found');
    }

    return this.mapToResponseDto(updatedCategory, userId);
  }

  async searchCategories(searchTerm: string, accountId?: string, userId?: string): Promise<CategoryResponseDto[]> {
    // Check account access if needed
    if (accountId && userId) {
      try {
        await this.accountsService.findOne(accountId, userId);
      } catch (error) {
        throw new ForbiddenException('You do not have access to this account');
      }
    }

    // Cache search results with shorter TTL
    const cacheKey = accountId ? `search:${searchTerm}:account:${accountId}` : `search:${searchTerm}:global`;

    return this.cacheService.cacheQuery(
      cacheKey,
      async () => {
        const categories = await this.categoriesRepository.searchCategories(searchTerm, accountId);
        return categories.map(category => this.mapToResponseDto(category, userId));
      },
      {
        ttl: 600, // 10 minutes for search results
        namespace: 'categories',
        tags: accountId ? [`account:${accountId}`, 'categories', 'search'] : ['categories', 'search']
      }
    );
  }

  async getCategoriesByType(type: ExpenseCategory, accountId?: string, userId?: string): Promise<CategoryResponseDto[]> {
    // Check account access if needed
    if (accountId && userId) {
      try {
        await this.accountsService.findOne(accountId, userId);
      } catch (error) {
        throw new ForbiddenException('You do not have access to this account');
      }
    }

    const cacheKey = accountId ? `type:${type}:account:${accountId}` : `type:${type}:global`;

    return this.cacheService.cacheQuery(
      cacheKey,
      async () => {
        const categories = await this.categoriesRepository.findByType(type, accountId);
        return categories.map(category => this.mapToResponseDto(category, userId));
      },
      {
        ttl: 1800, // 30 minutes for type-based queries
        namespace: 'categories',
        tags: accountId ? [`account:${accountId}`, 'categories'] : ['categories']
      }
    );
  }

  async getStats(accountId?: string, userId?: string) {
    // Check account access if needed
    if (accountId && userId) {
      try {
        await this.accountsService.findOne(accountId, userId);
      } catch (error) {
        throw new ForbiddenException('You do not have access to this account');
      }
    }

    const cacheKey = accountId ? `stats:account:${accountId}` : 'stats:global';

    return this.cacheService.cacheCalculation(cacheKey, async () => this.categoriesRepository.getCategoryStats(accountId));
  }

  async getPopularCategories(accountId?: string, userId?: string, limit = 10) {
    // Check account access if needed
    if (accountId && userId) {
      try {
        await this.accountsService.findOne(accountId, userId);
      } catch (error) {
        throw new ForbiddenException('You do not have access to this account');
      }
    }

    const cacheKey = accountId ? `popular:account:${accountId}:limit:${limit}` : `popular:global:limit:${limit}`;

    return this.cacheService.cacheCalculation(cacheKey, async () => this.categoriesRepository.getPopularCategories(accountId, limit));
  }

  async findAllHierarchy(accountId?: string, userId?: string, includeGlobal = true): Promise<CategoryHierarchyResponseDto[]> {
    // Check if user has access to the account
    if (accountId && userId) {
      try {
        await this.accountsService.findOne(accountId, userId);
      } catch (error) {
        throw new ForbiddenException('You do not have access to this account');
      }
    }

    // Create cache key based on parameters
    const cacheKey = accountId ? `hierarchy:account:${accountId}:global:${includeGlobal}` : 'hierarchy:global';

    // Try to get from cache first
    const cached = await this.cacheService.cacheQuery(
      cacheKey,
      async () => {
        const categories = await this.categoriesRepository.findAllHierarchy(accountId, includeGlobal);
        return categories.map(category => this.mapToHierarchyResponseDto(category, userId));
      },
      {
        ttl: 1800, // 30 minutes for hierarchy lists
        namespace: 'categories',
        tags: accountId ? [`account:${accountId}`, 'categories', 'hierarchy'] : ['categories', 'hierarchy']
      }
    );

    return cached;
  }

  async bulkOperation(bulkDto: BulkCategoryOperationDto, accountId?: string, userId?: string): Promise<BulkOperationResultDto> {
    // Check if user has permission to perform bulk operations
    if (accountId && userId) {
      try {
        await this.accountsService.findOne(accountId, userId);
        const userRole = await this.accountsService.getUserRole(accountId, userId);

        if (!userRole || !this.canBulkEditCategories(userRole, bulkDto.operation)) {
          throw new ForbiddenException('You do not have permission to perform bulk category operations');
        }
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        throw new ForbiddenException('You do not have access to this account');
      }
    }

    // Validate category IDs exist and user has access
    const categories = await this.categoriesRepository.findByIds(bulkDto.categoryIds);
    const foundIds = categories.map(cat => (cat as any)._id.toString());
    const missingIds = bulkDto.categoryIds.filter(id => !foundIds.includes(id));

    const result: BulkOperationResultDto = {
      success: 0,
      failed: missingIds.length,
      errors: missingIds.map(id => ({ categoryId: id, error: 'Category not found' }))
    };

    if (foundIds.length === 0) {
      return result;
    }

    // Validate permissions for each category
    const accessibleCategories = categories.filter(category => {
      // Check if user has access to the category
      if (category.accountId && accountId) {
        return category.accountId.toString() === accountId;
      }
      // Global categories can only be modified by system admins for delete operations
      if (!category.accountId && bulkDto.operation === BulkOperationType.DELETE) {
        return false; // Don't allow deleting global categories
      }
      return true;
    });

    const accessibleIds = accessibleCategories.map(cat => (cat as any)._id.toString());
    const unauthorizedIds = foundIds.filter(id => !accessibleIds.includes(id));

    // Add unauthorized errors
    result.failed += unauthorizedIds.length;
    result.errors = result.errors || [];
    result.errors.push(...unauthorizedIds.map(id => ({ categoryId: id, error: 'Access denied to this category' })));

    if (accessibleIds.length === 0) {
      return result;
    }

    try {
      let operationResult: { modifiedCount: number };

      switch (bulkDto.operation) {
        case BulkOperationType.DELETE:
          operationResult = await this.categoriesRepository.bulkSoftDelete(accessibleIds);
          break;
        case BulkOperationType.ACTIVATE:
          operationResult = await this.categoriesRepository.bulkUpdate(accessibleIds, { isActive: true });
          break;
        case BulkOperationType.DEACTIVATE:
          operationResult = await this.categoriesRepository.bulkUpdate(accessibleIds, { isActive: false });
          break;
        default:
          throw new BadRequestException('Invalid bulk operation type');
      }

      result.success = operationResult.modifiedCount;

      // Invalidate relevant caches
      if (accountId) {
        await this.cacheService.invalidateAccountCache(accountId);
      }
      await this.cacheService.invalidateByTags(['categories']);

      return result;
    } catch (error) {
      // If operation fails, mark all as failed
      result.failed += accessibleIds.length;
      result.success = 0;
      result.errors = result.errors || [];
      result.errors.push(...accessibleIds.map(id => ({ categoryId: id, error: 'Bulk operation failed' })));

      return result;
    }
  }

  async initializeGlobalCategories(): Promise<void> {
    // Check if global categories are already initialized (cached check)
    const cacheKey = 'global_categories_initialized';
    const isInitialized = await this.cacheService.get<boolean>(cacheKey, { namespace: 'system' });

    if (isInitialized) {
      return; // Already initialized
    }

    // Initialize predefined categories if they don't exist
    for (const [categoryType, config] of Object.entries(CATEGORY_CONFIG)) {
      const existingCategory = await this.categoriesRepository.findByName(categoryType);

      if (!existingCategory) {
        const createDto: CreateCategoryDto = {
          name: categoryType,
          displayName: categoryType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          type: categoryType as ExpenseCategory,
          icon: config.icon,
          color: config.color,
          subcategories: config.subcategories.map((sub, index) => ({
            name: sub,
            displayName: sub.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            isActive: true
          })),
          keywords: CATEGORY_KEYWORDS[categoryType as ExpenseCategory] || [],
          sortOrder: Object.keys(CATEGORY_CONFIG).indexOf(categoryType)
        };

        await this.categoriesRepository.create(createDto);
      }
    }

    // Mark as initialized in cache for 24 hours
    await this.cacheService.set(cacheKey, true, {
      ttl: 86400, // 24 hours
      namespace: 'system'
    });
  }

  // Permission helper methods
  private canCreateCategories(role: AccountRole): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return (
      permissions.includes(Permission.CREATE_BUDGET) || // Using budget permission as proxy
      role === AccountRole.OWNER ||
      role === AccountRole.BUSINESS_OWNER ||
      role === AccountRole.PARENT
    );
  }

  private canEditCategories(role: AccountRole): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return (
      permissions.includes(Permission.UPDATE_BUDGET) || // Using budget permission as proxy
      role === AccountRole.OWNER ||
      role === AccountRole.BUSINESS_OWNER ||
      role === AccountRole.PARENT
    );
  }

  private canDeleteCategories(role: AccountRole): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return (
      permissions.includes(Permission.DELETE_BUDGET) || // Using budget permission as proxy
      role === AccountRole.OWNER ||
      role === AccountRole.BUSINESS_OWNER ||
      role === AccountRole.PARENT
    );
  }

  private canBulkEditCategories(role: AccountRole, operation: BulkOperationType): boolean {
    switch (operation) {
      case BulkOperationType.DELETE:
        return this.canDeleteCategories(role);
      case BulkOperationType.ACTIVATE:
      case BulkOperationType.DEACTIVATE:
        return this.canEditCategories(role);
      default:
        return false;
    }
  }

  private mapToResponseDto(category: any, userId?: string): CategoryResponseDto {
    const canEdit = category.accountId && (!category.accountId || category.createdBy?.toString() === userId || category.isCustom);

    const canDelete = canEdit && category.isCustom;

    return {
      id: category._id.toString(),
      name: category.name,
      displayName: category.displayName,
      type: category.type,
      icon: category.icon,
      color: category.color,
      description: category.description,
      subcategories: category.subcategories.map((sub: any) => ({
        name: sub.name,
        displayName: sub.displayName,
        description: sub.description,
        isActive: sub.isActive
      })),
      accountId: category.accountId?.toString(),
      createdBy: category.createdBy?._id?.toString() || category.createdBy?.toString(),
      isCustom: category.isCustom,
      isActive: category.isActive,
      isVisible: category.isVisible,
      keywords: category.keywords || [],
      aiConfig: category.aiConfig || {},
      sortOrder: category.sortOrder,
      metadata: category.metadata || {},
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      subcategoryCount: category.subcategories?.length || 0,
      canEdit,
      canDelete
    };
  }

  private mapToHierarchyResponseDto(category: any, userId?: string): CategoryHierarchyResponseDto {
    const canEdit = category.accountId && (!category.accountId || category.createdBy?.toString() === userId || category.isCustom);

    const canDelete = canEdit && category.isCustom;

    return {
      id: category._id.toString(),
      name: category.name,
      displayName: category.displayName,
      type: category.type,
      icon: category.icon,
      color: category.color,
      description: category.description,
      subcategories: category.subcategories.map((sub: any) => ({
        name: sub.name,
        displayName: sub.displayName,
        description: sub.description,
        isActive: sub.isActive
      })),
      accountId: category.accountId?.toString(),
      createdBy: category.createdBy?._id?.toString() || category.createdBy?.toString(),
      isCustom: category.isCustom,
      isActive: category.isActive,
      isVisible: category.isVisible,
      keywords: category.keywords || [],
      sortOrder: category.sortOrder,
      subcategoryCount: category.subcategories?.length || 0,
      canEdit,
      canDelete,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    };
  }
}
