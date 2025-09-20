import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { UserProfile, UserProfileSchema } from '../../users/schemas/user-profile.schema';
import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../../files/files.module';
import { TransactionsModule } from '../../transactions/transactions.module';
import { AccountsModule } from '../../accounts/accounts.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema }
    ]),
    AiModule,
    FilesModule,
    TransactionsModule,
    AccountsModule,
    UsersModule
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService]
})
export class WhatsappModule {}
