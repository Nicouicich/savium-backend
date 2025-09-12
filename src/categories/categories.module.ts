import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';

import { Category, CategorySchema } from './schemas/category.schema';
import { AccountsModule } from '../accounts/accounts.module';
import { CommonModule } from '@common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }]),
    forwardRef(() => AccountsModule), // Use forwardRef to avoid circular dependency
    CommonModule
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  exports: [CategoriesService, CategoriesRepository]
})
export class CategoriesModule {}
