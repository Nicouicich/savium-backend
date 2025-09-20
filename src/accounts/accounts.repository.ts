import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { Account, AccountDocument } from './schemas/account.schema';
import { CreateAccountDto, UpdateAccountDto } from './dto';
import { AccountStatus, AccountType } from '@common/constants/account-types';
import { AccountRole } from '@common/constants/user-roles';

@Injectable()
export class AccountsRepository {
  constructor(
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>
  ) {}

  async create(userId: string, createAccountDto: CreateAccountDto): Promise<AccountDocument> {
    const account = new this.accountModel({
      ...createAccountDto,
      owner: userId,
      members: [
        {
          userId: userId,
          role: AccountRole.OWNER,
          joinedAt: new Date(),
          isActive: true,
          permissions: []
        }
      ]
    });

    return account.save();
  }

  async findById(id: string): Promise<AccountDocument | null> {
    return this.accountModel
      .findOne({ _id: id, isDeleted: false })
      .populate('owner', 'email firstName lastName')
      .populate('members.userId', 'email firstName lastName')
      .exec();
  }

  async findByUserId(userId: string): Promise<AccountDocument[]> {
    return this.accountModel
      .find({
        $or: [{ owner: userId }, { 'members.userId': userId, 'members.isActive': true }],
        isDeleted: false
      })
      .populate('owner', 'email firstName lastName')
      .populate('members.userId', 'email firstName lastName')
      .sort({ lastActivityAt: -1 })
      .exec();
  }

  async findByUserIdOptimized(userId: string): Promise<AccountDocument[]> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          $or: [
            { owner: userId },
            {
              'members.userId': userId,
              'members.isActive': true
            }
          ],
          isDeleted: false
        }
      },

      // Lookup owner information
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'ownerInfo',
          pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1 } }]
        }
      },

      // Lookup member user information
      {
        $lookup: {
          from: 'users',
          localField: 'members.userId',
          foreignField: '_id',
          as: 'memberUsers',
          pipeline: [{ $project: { email: 1, firstName: 1, lastName: 1 } }]
        }
      },

      // Process members with their user info
      {
        $addFields: {
          owner: { $arrayElemAt: ['$ownerInfo', 0] },
          members: {
            $map: {
              input: '$members',
              as: 'member',
              in: {
                $mergeObjects: [
                  '$$member',
                  {
                    userId: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$memberUsers',
                            cond: { $eq: ['$$this._id', '$$member.userId'] }
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },

      // Remove temporary fields
      {
        $project: {
          ownerInfo: 0,
          memberUsers: 0
        }
      },

      // Sort by activity
      { $sort: { lastActivityAt: -1 } }
    ];

    return this.accountModel.aggregate(pipeline).exec();
  }

  async findByType(type: AccountType): Promise<AccountDocument[]> {
    return this.accountModel.find({ type, isDeleted: false }).populate('owner', 'email firstName lastName').exec();
  }

  async update(id: string, updateAccountDto: UpdateAccountDto): Promise<AccountDocument | null> {
    return this.accountModel
      .findByIdAndUpdate(
        id,
        {
          ...updateAccountDto,
          lastActivityAt: new Date()
        },
        { new: true }
      )
      .populate('owner', 'email firstName lastName')
      .populate('members.userId', 'email firstName lastName')
      .exec();
  }

  async softDelete(id: string): Promise<AccountDocument | null> {
    return this.accountModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          status: AccountStatus.INACTIVE
        },
        { new: true }
      )
      .exec();
  }

  async addMember(accountId: string, userId: string, role: AccountRole, transactionLimit?: number): Promise<AccountDocument | null> {
    return this.accountModel
      .findByIdAndUpdate(
        accountId,
        {
          $push: {
            members: {
              userId: userId,
              role,
              joinedAt: new Date(),
              isActive: true,
              transactionLimit: transactionLimit || 0,
              permissions: []
            }
          },
          lastActivityAt: new Date()
        },
        { new: true }
      )
      .populate('owner', 'email firstName lastName')
      .populate('members.userId', 'email firstName lastName')
      .exec();
  }

  async updateMember(
    accountId: string,
    memberId: string,
    updates: {
      role?: AccountRole;
      isActive?: boolean;
      transactionLimit?: number;
      permissions?: string[];
    }
  ): Promise<AccountDocument | null> {
    const updateFields: any = { lastActivityAt: new Date() };

    if (updates.role !== undefined) {
      updateFields['members.$.role'] = updates.role;
    }
    if (updates.isActive !== undefined) {
      updateFields['members.$.isActive'] = updates.isActive;
    }
    if (updates.transactionLimit !== undefined) {
      updateFields['members.$.transactionLimit'] = updates.transactionLimit;
    }
    if (updates.permissions !== undefined) {
      updateFields['members.$.permissions'] = updates.permissions;
    }

    return this.accountModel
      .findOneAndUpdate(
        {
          _id: accountId,
          'members.userId': memberId
        },
        { $set: updateFields },
        { new: true }
      )
      .populate('owner', 'email firstName lastName')
      .populate('members.userId', 'email firstName lastName')
      .exec();
  }

  async removeMember(accountId: string, memberId: string): Promise<AccountDocument | null> {
    return this.accountModel
      .findByIdAndUpdate(
        accountId,
        {
          $pull: { members: { userId: memberId } },
          lastActivityAt: new Date()
        },
        { new: true }
      )
      .populate('owner', 'email firstName lastName')
      .populate('members.userId', 'email firstName lastName')
      .exec();
  }

  async addInvitation(
    accountId: string,
    invitation: {
      email: string;
      role: AccountRole;
      invitedBy: string;
      token: string;
      expiresAt: Date;
      transactionLimit?: number;
    }
  ): Promise<AccountDocument | null> {
    return this.accountModel
      .findByIdAndUpdate(
        accountId,
        {
          $push: {
            pendingInvitations: {
              ...invitation,
              invitedBy: invitation.invitedBy,
              invitedAt: new Date(),
              status: 'pending'
            }
          },
          lastActivityAt: new Date()
        },
        { new: true }
      )
      .populate('owner', 'email firstName lastName')
      .populate('members.userId', 'email firstName lastName')
      .exec();
  }

  async updateInvitation(accountId: string, invitationToken: string, status: string): Promise<AccountDocument | null> {
    return this.accountModel
      .findOneAndUpdate(
        {
          _id: accountId,
          'pendingInvitations.token': invitationToken
        },
        {
          $set: {
            'pendingInvitations.$.status': status,
            lastActivityAt: new Date()
          }
        },
        { new: true }
      )
      .populate('owner', 'email firstName lastName')
      .populate('members.userId', 'email firstName lastName')
      .exec();
  }

  async removeInvitation(accountId: string, invitationToken: string): Promise<AccountDocument | null> {
    return this.accountModel
      .findByIdAndUpdate(
        accountId,
        {
          $pull: { pendingInvitations: { token: invitationToken } },
          lastActivityAt: new Date()
        },
        { new: true }
      )
      .exec();
  }

  async findByInvitationToken(token: string): Promise<AccountDocument | null> {
    return this.accountModel
      .findOne({
        'pendingInvitations.token': token,
        'pendingInvitations.status': 'pending',
        'pendingInvitations.expiresAt': { $gte: new Date() },
        isDeleted: false
      })
      .populate('owner', 'email firstName lastName')
      .populate('members.userId', 'email firstName lastName')
      .exec();
  }

  async findUserRole(accountId: string, userId: string): Promise<AccountRole | null> {
    const account = await this.accountModel
      .findOne({
        _id: accountId,
        'members.userId': userId,
        'members.isActive': true,
        isDeleted: false
      })
      .exec();

    if (!account) return null;

    const member = account.members.find(m => m.userId.toString() === userId && m.isActive);

    return member?.role || null;
  }

  async getAccountStats(accountId: string): Promise<{
    totalMembers: number;
    activeMembers: number;
    pendingInvitations: number;
    accountType: AccountType;
    createdAt: Date;
  } | null> {
    const account = await this.accountModel.findById(accountId).select('members pendingInvitations type createdAt').exec();

    if (!account) return null;

    return {
      totalMembers: account.members.length,
      activeMembers: account.members.filter(m => m.isActive).length,
      pendingInvitations: account.pendingInvitations.filter(i => i.status === 'pending').length,
      accountType: account.type,
      createdAt: (account as any).createdAt
    };
  }

  async updateLastActivity(accountId: string): Promise<void> {
    await this.accountModel.findByIdAndUpdate(accountId, { lastActivityAt: new Date() }).exec();
  }
}
