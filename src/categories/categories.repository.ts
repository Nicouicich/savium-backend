import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { TransactionCategory } from '@common/constants/transaction-categories';

@Injectable()
export class CategoriesRepository {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>
  ) {}

  
}
