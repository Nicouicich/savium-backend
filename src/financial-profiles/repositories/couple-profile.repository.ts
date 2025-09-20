import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProfileType } from '../schemas';
import { CoupleProfile, CoupleProfileDocument } from '../schemas/couple-profile.schema';
import { BaseProfileRepository } from './base-profile.repository';

@Injectable()
export class CoupleProfileRepository extends BaseProfileRepository<CoupleProfile, CoupleProfileDocument> {
  constructor(
    @InjectModel(ProfileType.COUPLE) coupleProfileModel: Model<CoupleProfileDocument>
  ) {
    super(coupleProfileModel);
  }

  async findByRefAndUserId(ref: string, userId: string): Promise<CoupleProfile | null> {
    return await this.model
      .findOne({
        userId,
        _id: ref
      })
      .populate('categories')
      .exec();
  }

  /**
   * Couple profiles are limited to 1 per user
   */
  async validateUserCanCreate(userId: string): Promise<boolean> {
    const count = await this.countByUser(userId);
    return count === 0;
  }

  /**
   * Find user's couple profile (should be only one)
   */
  async findCoupleProfile(userId: string): Promise<CoupleProfileDocument | null> {
    const profiles = await this.findAllByUser(userId);
    return profiles[0] || null;
  }

  /**
   * Add partner to couple profile
   */
  async addPartner(profileId: string, userId: string, partnerId: string): Promise<CoupleProfileDocument | null> {
    return this.update(profileId, userId, {
      partnerId: new Types.ObjectId(partnerId),
      relationshipStatus: 'active'
    } as Partial<CoupleProfile>);
  }

  /**
   * Update couple settings
   */
  async updateCoupleSettings(profileId: string, userId: string, settings: any): Promise<CoupleProfileDocument | null> {
    return this.update(profileId, userId, { coupleSettings: settings } as Partial<CoupleProfile>);
  }

  /**
   * Add shared goal to couple profile
   */
  async addSharedGoal(profileId: string, userId: string, sharedGoal: any): Promise<CoupleProfileDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: profileId,
          userId,
          status: 'active'
        },
        {
          $push: { sharedGoals: sharedGoal },
          lastUsedAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Update transaction sharing rules
   */
  async updateTransactionSharing(profileId: string, userId: string, sharingRules: any[]): Promise<CoupleProfileDocument | null> {
    return this.update(profileId, userId, { transactionSharing: sharingRules } as Partial<CoupleProfile>);
  }
}
