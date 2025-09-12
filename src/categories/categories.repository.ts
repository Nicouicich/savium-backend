import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { ExpenseCategory } from '@common/constants/expense-categories';

@Injectable()
export class CategoriesRepository {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>
  ) {}

  async create(createCategoryDto: CreateCategoryDto, accountId?: string, createdBy?: string): Promise<CategoryDocument> {
    const category = new this.categoryModel({
      ...createCategoryDto,
      accountId: accountId ? new Types.ObjectId(accountId) : undefined,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
      isCustom: !!accountId // Custom if it belongs to an account
    });

    return category.save();
  }

  async findAll(accountId?: string, includeGlobal = true): Promise<CategoryDocument[]> {
    const query: any = { isDeleted: false, isActive: true };

    if (accountId && includeGlobal) {
      // Include both account-specific and global categories
      query.$or = [{ accountId: new Types.ObjectId(accountId) }, { accountId: { $exists: false } }];
    } else if (accountId) {
      // Only account-specific categories
      query.accountId = new Types.ObjectId(accountId);
    } else {
      // Only global categories
      query.accountId = { $exists: false };
    }

    return this.categoryModel.find(query).sort({ sortOrder: 1, displayName: 1 }).exec();
  }

  async findById(id: string): Promise<CategoryDocument | null> {
    return this.categoryModel.findOne({ _id: id, isDeleted: false }).populate('createdBy', 'email firstName lastName').exec();
  }

  async findByName(name: string, accountId?: string): Promise<CategoryDocument | null> {
    const query: any = {
      name: name.toLowerCase(),
      isDeleted: false
    };

    if (accountId) {
      query.accountId = new Types.ObjectId(accountId);
    } else {
      query.accountId = { $exists: false };
    }

    return this.categoryModel.findOne(query).exec();
  }

  async findByType(type: ExpenseCategory, accountId?: string): Promise<CategoryDocument[]> {
    const query: any = {
      type,
      isDeleted: false,
      isActive: true
    };

    if (accountId) {
      query.$or = [{ accountId: new Types.ObjectId(accountId) }, { accountId: { $exists: false } }];
    } else {
      query.accountId = { $exists: false };
    }

    return this.categoryModel.find(query).sort({ sortOrder: 1, displayName: 1 }).exec();
  }

  async findByKeywords(keywords: string[], accountId?: string): Promise<CategoryDocument[]> {
    const query: any = {
      keywords: { $in: keywords },
      isDeleted: false,
      isActive: true
    };

    if (accountId) {
      query.$or = [{ accountId: new Types.ObjectId(accountId) }, { accountId: { $exists: false } }];
    } else {
      query.accountId = { $exists: false };
    }

    return this.categoryModel.find(query).sort({ sortOrder: 1, displayName: 1 }).exec();
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<CategoryDocument | null> {
    return this.categoryModel.findByIdAndUpdate(id, updateCategoryDto, { new: true }).populate('createdBy', 'email firstName lastName').exec();
  }

  async softDelete(id: string): Promise<CategoryDocument | null> {
    return this.categoryModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false
        },
        { new: true }
      )
      .exec();
  }

  async addSubcategory(
    categoryId: string,
    subcategory: {
      name: string;
      displayName: string;
      description?: string;
      isActive?: boolean;
    }
  ): Promise<CategoryDocument | null> {
    return this.categoryModel
      .findByIdAndUpdate(
        categoryId,
        {
          $push: {
            subcategories: {
              ...subcategory,
              isActive: subcategory.isActive !== undefined ? subcategory.isActive : true
            }
          }
        },
        { new: true }
      )
      .exec();
  }

  async updateSubcategory(
    categoryId: string,
    subcategoryName: string,
    updates: {
      displayName?: string;
      description?: string;
      isActive?: boolean;
    }
  ): Promise<CategoryDocument | null> {
    const updateFields: any = {};

    if (updates.displayName !== undefined) {
      updateFields['subcategories.$.displayName'] = updates.displayName;
    }
    if (updates.description !== undefined) {
      updateFields['subcategories.$.description'] = updates.description;
    }
    if (updates.isActive !== undefined) {
      updateFields['subcategories.$.isActive'] = updates.isActive;
    }

    return this.categoryModel
      .findOneAndUpdate(
        {
          _id: categoryId,
          'subcategories.name': subcategoryName
        },
        { $set: updateFields },
        { new: true }
      )
      .exec();
  }

  async removeSubcategory(categoryId: string, subcategoryName: string): Promise<CategoryDocument | null> {
    return this.categoryModel
      .findByIdAndUpdate(
        categoryId,
        {
          $pull: { subcategories: { name: subcategoryName } }
        },
        { new: true }
      )
      .exec();
  }

  async updateSortOrder(categoryId: string, sortOrder: number): Promise<CategoryDocument | null> {
    return this.categoryModel.findByIdAndUpdate(categoryId, { sortOrder }, { new: true }).exec();
  }

  async toggleVisibility(categoryId: string, isVisible: boolean): Promise<CategoryDocument | null> {
    return this.categoryModel.findByIdAndUpdate(categoryId, { isVisible }, { new: true }).exec();
  }

  async getCustomCategories(accountId: string): Promise<CategoryDocument[]> {
    return this.categoryModel
      .find({
        accountId: new Types.ObjectId(accountId),
        isCustom: true,
        isDeleted: false
      })
      .sort({ sortOrder: 1, displayName: 1 })
      .exec();
  }

  async getGlobalCategories(): Promise<CategoryDocument[]> {
    return this.categoryModel
      .find({
        accountId: { $exists: false },
        isCustom: false,
        isDeleted: false,
        isActive: true
      })
      .sort({ sortOrder: 1, displayName: 1 })
      .exec();
  }

  async searchCategories(searchTerm: string, accountId?: string): Promise<CategoryDocument[]> {
    const regex = new RegExp(searchTerm, 'i');
    const query: any = {
      $or: [
        { displayName: regex },
        { description: regex },
        { keywords: regex },
        { 'subcategories.displayName': regex },
        { 'subcategories.description': regex }
      ],
      isDeleted: false,
      isActive: true,
      isVisible: true
    };

    if (accountId) {
      query.$and = [
        {
          $or: [{ accountId: new Types.ObjectId(accountId) }, { accountId: { $exists: false } }]
        }
      ];
    } else {
      query.accountId = { $exists: false };
    }

    return this.categoryModel.find(query).sort({ sortOrder: 1, displayName: 1 }).exec();
  }

  async getCategoryStats(accountId?: string): Promise<{
    total: number;
    custom: number;
    global: number;
    active: number;
    inactive: number;
  }> {
    const baseQuery: any = { isDeleted: false };

    if (accountId) {
      baseQuery.$or = [{ accountId: new Types.ObjectId(accountId) }, { accountId: { $exists: false } }];
    }

    const [stats] = await this.categoryModel.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          custom: {
            $sum: {
              $cond: [{ $eq: ['$isCustom', true] }, 1, 0]
            }
          },
          global: {
            $sum: {
              $cond: [{ $eq: ['$isCustom', false] }, 1, 0]
            }
          },
          active: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0]
            }
          },
          inactive: {
            $sum: {
              $cond: [{ $eq: ['$isActive', false] }, 1, 0]
            }
          }
        }
      }
    ]);

    return stats || { total: 0, custom: 0, global: 0, active: 0, inactive: 0 };
  }

  async getPopularCategories(
    accountId?: string,
    limit = 10
  ): Promise<
    {
      categoryId: string;
      name: string;
      displayName: string;
      usageCount: number;
    }[]
  > {
    // This would typically join with expenses collection
    // For now, return categories ordered by creation date
    const query: any = {
      isDeleted: false,
      isActive: true,
      isVisible: true
    };

    if (accountId) {
      query.$or = [{ accountId: new Types.ObjectId(accountId) }, { accountId: { $exists: false } }];
    } else {
      query.accountId = { $exists: false };
    }

    const categories = await this.categoryModel.find(query).sort({ createdAt: -1 }).limit(limit).select('name displayName').exec();

    return categories.map(cat => ({
      categoryId: (cat as any)._id.toString(),
      name: cat.name,
      displayName: cat.displayName,
      usageCount: 0 // Would be calculated from expenses
    }));
  }

  async findAllHierarchy(accountId?: string, includeGlobal = true): Promise<CategoryDocument[]> {
    const query: any = { isDeleted: false };

    if (accountId && includeGlobal) {
      // Include both account-specific and global categories
      query.$or = [{ accountId: new Types.ObjectId(accountId) }, { accountId: { $exists: false } }];
    } else if (accountId) {
      // Only account-specific categories
      query.accountId = new Types.ObjectId(accountId);
    } else {
      // Only global categories
      query.accountId = { $exists: false };
    }

    return this.categoryModel.find(query).populate('createdBy', 'email firstName lastName').sort({ sortOrder: 1, displayName: 1 }).exec();
  }

  async bulkUpdate(categoryIds: string[], updateData: Partial<CategoryDocument>): Promise<{ modifiedCount: number }> {
    const objectIds = categoryIds.map(id => new Types.ObjectId(id));

    const result = await this.categoryModel.updateMany(
      {
        _id: { $in: objectIds },
        isDeleted: false
      },
      { $set: updateData }
    );

    return { modifiedCount: result.modifiedCount };
  }

  async bulkSoftDelete(categoryIds: string[]): Promise<{ modifiedCount: number }> {
    const objectIds = categoryIds.map(id => new Types.ObjectId(id));

    const result = await this.categoryModel.updateMany(
      {
        _id: { $in: objectIds },
        isDeleted: false
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false
        }
      }
    );

    return { modifiedCount: result.modifiedCount };
  }

  async findByIds(categoryIds: string[]): Promise<CategoryDocument[]> {
    const objectIds = categoryIds.map(id => new Types.ObjectId(id));

    return this.categoryModel
      .find({
        _id: { $in: objectIds },
        isDeleted: false
      })
      .exec();
  }
}
