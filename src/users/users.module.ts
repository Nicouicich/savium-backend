import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { UserAuthService } from './services/user-auth.service';
import { UserProfileService } from './services/user-profile.service';
import { UserQueryService } from './services/user-query.service';
import { UserCommandService } from './services/user-command.service';

import { User, UserSchema } from './schemas/user.schema';
import { UserAuth, UserAuthSchema } from './schemas/user-auth.schema';
import { UserProfile, UserProfileSchema } from './schemas/user-profile.schema';

@Module({
  imports: [
    ConfigModule,
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
