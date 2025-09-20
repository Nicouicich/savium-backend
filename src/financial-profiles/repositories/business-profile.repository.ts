import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProfileType } from '../schemas';
import { CompanyProfile, CompanyProfileDocument } from '../schemas/business-profile.schema';
import { BaseProfileRepository } from './base-profile.repository';

@Injectable()
export class CompanyProfileRepository extends BaseProfileRepository<CompanyProfile, CompanyProfileDocument> {
  constructor(
    @InjectModel(ProfileType.BUSINESS) companyProfileModel: Model<CompanyProfileDocument>
  ) {
    super(companyProfileModel);
  }

  async findByRefAndUserId(ref: string, userId: string): Promise<CompanyProfile | null> {
    return await this.model
      .findOne({
        userId,
        _id: ref
      })
      .populate('categories')
      .exec();
  }

  /**
   * Business profiles are limited to 5 per user
   */
  async validateUserCanCreate(userId: string): Promise<boolean> {
    const count = await this.countByUser(userId);
    return count < 5;
  }

  /**
   * Add team member to business profile
   */
  async addTeamMember(profileId: string, userId: string, memberData: any): Promise<CompanyProfileDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: profileId,
          userId,
          status: 'active'
        },
        {
          $push: { team: memberData },
          lastUsedAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Remove team member from business profile
   */
  async removeTeamMember(profileId: string, userId: string, memberUserId: string): Promise<CompanyProfileDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: profileId,
          userId,
          status: 'active'
        },
        {
          $pull: { team: { userId: new Types.ObjectId(memberUserId) } },
          lastUsedAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Update business settings
   */
  async updateBusinessSettings(profileId: string, userId: string, settings: any): Promise<CompanyProfileDocument | null> {
    return this.update(profileId, userId, { businessSettings: settings } as Partial<CompanyProfile>);
  }

  /**
   * Add project to business profile
   */
  async addProject(profileId: string, userId: string, project: any): Promise<CompanyProfileDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: profileId,
          userId,
          status: 'active'
        },
        {
          $push: { projects: project },
          lastUsedAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Update project in business profile
   */
  async updateProject(profileId: string, userId: string, projectId: string, updateData: any): Promise<CompanyProfileDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: profileId,
          userId,
          status: 'active',
          'projects._id': projectId
        },
        {
          $set: {
            'projects.$': { ...updateData, _id: projectId },
            lastUsedAt: new Date()
          }
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Add department to business profile
   */
  async addDepartment(profileId: string, userId: string, department: any): Promise<CompanyProfileDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: profileId,
          userId,
          status: 'active'
        },
        {
          $push: { departments: department },
          lastUsedAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Update financial summary for business profile
   */
  async updateFinancialSummary(profileId: string, userId: string, summary: any): Promise<CompanyProfileDocument | null> {
    return this.update(profileId, userId, { financialSummary: summary } as Partial<CompanyProfile>);
  }

  /**
   * Get team members by role
   */
  async getTeamByRole(profileId: string, userId: string, role: string): Promise<any[]> {
    const profile = await this.findOne(profileId, userId);
    if (!profile) return [];

    return profile.team.filter(member => member.role === role && member.isActive);
  }

  /**
   * Get active projects
   */
  async getActiveProjects(profileId: string, userId: string): Promise<any[]> {
    const profile = await this.findOne(profileId, userId);
    if (!profile) return [];

    return profile.projects.filter(project => project.isActive);
  }
}
