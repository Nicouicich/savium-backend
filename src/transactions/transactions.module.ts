import { CommonModule } from '@common/common.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { CardsModule } from '../cards/cards.module';
import { CategoriesModule } from '../categories/categories.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { UsersModule } from '../users/users.module';
import { FileUploadService } from './file-upload.service';
import { PdfExportService } from './pdf-export.service';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Transaction.name, schema: TransactionSchema }]),
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
    CategoriesModule,
    UsersModule,
    CommonModule,
    PaymentMethodsModule,
    CardsModule
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsRepository, FileUploadService, PdfExportService],
  exports: [TransactionsService, TransactionsRepository]
})
export class TransactionsModule {}
