import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from 'src/users/users.module';
import { FilesModule } from '../../files/files.module';
import { TransactionsModule } from '../../transactions/transactions.module';
import { UserProfile, UserProfileSchema } from '../../users/schemas/user-profile.schema';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { AiModule } from '../ai/ai.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema }
    ]),
    AiModule,
    FilesModule,
    TransactionsModule,
    UsersModule
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService]
})
export class WhatsappModule {}
