import { TransactionCategory } from '@common/constants/transaction-categories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { Category, CategoryDocument } from './schemas/category.schema';

@Injectable()
export class CategoriesRepository {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>
  ) {}
}
