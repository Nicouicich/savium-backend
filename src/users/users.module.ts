import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { UserAuthService } from './services/user-auth.service';
import { UserCommandService } from './services/user-command.service';
import { UserProfileService } from './services/user-profile.service';
import { UserQueryService } from './services/user-query.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

import { FinancialProfilesModule } from '../financial-profiles/financial-profiles.module';
import { UserAuth, UserAuthSchema } from './schemas/user-auth.schema';
import { UserProfile, UserProfileSchema } from './schemas/user-profile.schema';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => FinancialProfilesModule),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserAuth.name, schema: UserAuthSchema },
      { name: UserProfile.name, schema: UserProfileSchema }
    ])
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserAuthService, UserProfileService, UserQueryService, UserCommandService],
  exports: [UsersService, UsersRepository, UserAuthService, UserProfileService, UserQueryService, UserCommandService]
})
export class UsersModule {}
