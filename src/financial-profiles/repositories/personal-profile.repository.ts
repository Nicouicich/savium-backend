import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PersonalProfile, PersonalProfileDocument } from '../schemas/personal-profile.schema';
import { BaseProfileRepository } from './base-profile.repository';
import { ProfileType } from '../schemas';

@Injectable()
export class PersonalProfileRepository extends BaseProfileRepository<PersonalProfile, PersonalProfileDocument> {
  constructor(@InjectModel(ProfileType.PERSONAL) personalProfileModel: Model<PersonalProfileDocument>) {
    super(personalProfileModel);
  }

  async getUserPersonalProfile(userId: string): Promise<PersonalProfileDocument | null> {
    return await this.model.findById(userId);
  }

  async createPersonalProfile(userId: string): Promise<PersonalProfileDocument> {
    return await this.model.create({
      userId: userId,
      name: 'Personal Profile',
      status: 'active',
      isDefault: true,
      privacy: {
        visibility: 'private',
        showContactInfo: false,
        showSocialLinks: false,
        indexInSearchEngines: false
      },
      associatedAccounts: [],
      categories: [],
      lastUsedAt: new Date()
    });
  }

  async findByRefAndUserId(ref: string, userId: string): Promise<PersonalProfile | null> {
    return await this.model
      .findOne({
        userId,
        _id: ref
      })
      .populate('categories')
      .exec();
  }
}
