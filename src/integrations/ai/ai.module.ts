import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { MessageProcessorService } from './message-processor.service';
import { ReceiptProcessorService } from './receipt-processor.service';
import { FilesModule } from '../../files/files.module';
import { ExpensesModule } from '../../expenses/expenses.module';
import { CategoriesModule } from '../../categories/categories.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [FilesModule, forwardRef(() => ExpensesModule), CategoriesModule, UsersModule],
  controllers: [AiController],
  providers: [AiService, MessageProcessorService, ReceiptProcessorService],
  exports: [AiService, MessageProcessorService, ReceiptProcessorService]
})
export class AiModule {}
