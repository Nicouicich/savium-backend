import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FamilyProfile, FamilyProfileDocument } from '../schemas/family-profile.schema';
import { BaseProfileRepository } from './base-profile.repository';
import { ProfileType } from '../schemas';

@Injectable()
export class FamilyProfileRepository extends BaseProfileRepository<FamilyProfile, FamilyProfileDocument> {
  constructor(
    @InjectModel(ProfileType.FAMILY)
    familyProfileModel: Model<FamilyProfileDocument>
  ) {
    super(familyProfileModel);
  }

  async findByRefAndUserId(ref: string, userId: string): Promise<FamilyProfile | null> {
    return await this.model
      .findOne({
        userId,
        _id: ref
      })
      .populate('categories')
      .exec();
  }

  /**
   * Family profiles are limited to 3 per user
   */
  async validateUserCanCreate(userId: string): Promise<boolean> {
    const count = await this.countByUser(userId);
    return count < 3;
  }

  /**
   * Add family member
   */
  async addMember(profileId: string, userId: string, memberData: any): Promise<FamilyProfileDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: profileId,
          userId,
          status: 'active'
        },
        {
          $push: { members: memberData },
          lastUsedAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Remove family member
   */
  async removeMember(profileId: string, userId: string, memberUserId: string): Promise<FamilyProfileDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: profileId,
          userId,
          status: 'active'
        },
        {
          $pull: { members: { userId: new Types.ObjectId(memberUserId) } },
          lastUsedAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Update family settings
   */
  async updateFamilySettings(profileId: string, userId: string, settings: any): Promise<FamilyProfileDocument | null> {
    return this.update(profileId, userId, { familySettings: settings } as Partial<FamilyProfile>);
  }

  /**
   * Add family goal
   */
  async addFamilyGoal(profileId: string, userId: string, familyGoal: any): Promise<FamilyProfileDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: profileId,
          userId,
          status: 'active'
        },
        {
          $push: { familyGoals: familyGoal },
          lastUsedAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Update allowances for children
   */
  async updateAllowances(profileId: string, userId: string, allowances: any[]): Promise<FamilyProfileDocument | null> {
    return this.update(profileId, userId, { allowances } as Partial<FamilyProfile>);
  }

  /**
   * Get children members only
   */
  async getChildren(profileId: string, userId: string): Promise<any[]> {
    const profile = await this.findOne(profileId, userId);
    if (!profile) return [];

    return profile.members.filter(member => member.role === 'child');
  }
}
