import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { MessageProcessorService } from './message-processor.service';
import { ReceiptProcessorService } from './receipt-processor.service';
import { FilesModule } from '../../files/files.module';
import { TransactionsModule } from '../../transactions/transactions.module';
import { CategoriesModule } from '../../categories/categories.module';
import { FinancialProfilesModule } from '../../financial-profiles/financial-profiles.module';

@Module({
  imports: [FilesModule, forwardRef(() => TransactionsModule), CategoriesModule, FinancialProfilesModule],
  controllers: [],
  providers: [AiService, MessageProcessorService, ReceiptProcessorService],
  exports: [AiService, MessageProcessorService, ReceiptProcessorService]
})
export class AiModule {}
