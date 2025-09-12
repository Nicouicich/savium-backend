import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesRepository } from './expenses.repository';
import { FileUploadService } from './file-upload.service';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { CommonModule } from '@common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Expense.name, schema: ExpenseSchema }]),
    MulterModule.register({
      dest: './uploads/receipts',
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req: any, file: any, callback: any) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
          return callback(new Error('Only image and PDF files are allowed!'), false);
        }
        callback(null, true);
      }
    }),
    AccountsModule,
    CategoriesModule,
    UsersModule,
    CommonModule
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesRepository, FileUploadService],
  exports: [ExpensesService, ExpensesRepository]
})
export class ExpensesModule {}
