import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinancialProfilesService } from './financial-profiles.service';
import { PersonalProfileRepository, CoupleProfileRepository, FamilyProfileRepository, CompanyProfileRepository } from './repositories';
import { PROFILE_SCHEMAS } from './schemas';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PROFILE_SCHEMAS.personal.name, schema: PROFILE_SCHEMAS.personal.schema },
      { name: PROFILE_SCHEMAS.couple.name, schema: PROFILE_SCHEMAS.couple.schema },
      { name: PROFILE_SCHEMAS.family.name, schema: PROFILE_SCHEMAS.family.schema },
      { name: PROFILE_SCHEMAS.business.name, schema: PROFILE_SCHEMAS.business.schema }
    ]),
    forwardRef(() => UsersModule)
  ],
  providers: [FinancialProfilesService, PersonalProfileRepository, CoupleProfileRepository, FamilyProfileRepository, CompanyProfileRepository],
  exports: [FinancialProfilesService, PersonalProfileRepository, CoupleProfileRepository, FamilyProfileRepository, CompanyProfileRepository]
})
export class FinancialProfilesModule {}
