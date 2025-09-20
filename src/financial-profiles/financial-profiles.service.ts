import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { CompanyProfileRepository, CoupleProfileRepository, FamilyProfileRepository, PersonalProfileRepository } from './repositories';
import { AnyProfileDocument, BaseProfile, PersonalProfileDocument, ProfileType } from './schemas';

export interface CreateProfileData {
  type: ProfileType;
  name: string;
  description?: string;
  currency?: string;
  timezone?: string;
  settings?: any;
}

export interface ProfileResponseDto {
  id: string;
  userId: string;
  type: ProfileType;
  name: string;
  description?: string;
  currency: string;
  timezone: string;
  settings: any;
  status: string;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class FinancialProfilesService {
  private readonly logger = new Logger(FinancialProfilesService.name);

  constructor(
    private readonly personalProfileRepository: PersonalProfileRepository,
    private readonly coupleProfileRepository: CoupleProfileRepository,
    private readonly familyProfileRepository: FamilyProfileRepository,
    private readonly companyProfileRepository: CompanyProfileRepository,
    private readonly usersService: UsersService
  ) {}

  async getProfile(ref: string, userId: string, profileType: ProfileType): Promise<BaseProfile | null> {
    switch (profileType) {
      case ProfileType.PERSONAL:
        return this.personalProfileRepository.findByRefAndUserId(ref, userId);
      case ProfileType.COUPLE:
        return this.coupleProfileRepository.findByRefAndUserId(ref, userId);
      case ProfileType.FAMILY:
        return this.familyProfileRepository.findByRefAndUserId(ref, userId);
      case ProfileType.BUSINESS:
        return this.companyProfileRepository.findByRefAndUserId(ref, userId);
      default:
        return null;
    }
  }
}
