import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { ProfileRepository } from './profiles.repository';
import { Profile, ProfileSchema } from './schemas/profile.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Profile.name, schema: ProfileSchema }]), UsersModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, ProfileRepository],
  exports: [ProfilesService, ProfileRepository] // Export for use in other modules
})
export class ProfilesModule {}
