import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { FileUploadService } from './file-upload.service';
import { PdfExportService } from './pdf-export.service';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { ProfilesModule } from '../profiles/profiles.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { CardsModule } from '../cards/cards.module';
import { CommonModule } from '@common/common.module';

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
    ProfilesModule,
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
