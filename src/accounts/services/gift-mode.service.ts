import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Transaction, TransactionDocument } from '../../transactions/schemas/transaction.schema';
import { Account, AccountDocument } from '../schemas/account.schema';
import { Profile, ProfileDocument } from '../../profiles/schemas/profile.schema';
import { CoupleSettings, CoupleSettingsDocument } from '../schemas/couple-settings.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { ProfilesService } from '../../profiles/profiles.service';

import { CoupleTransactionType, CoupleNotificationType } from '@common/constants/couple-types';
import { AccountType } from '@common/constants/account-types';
import { PaymentMethod } from '@common/constants/transaction-categories';
import { ProfileType } from 'src/financial-profiles/schemas';

export interface GiftTransactionDto {
  description: string;
  amount: number;
  categoryId: string;
  giftForUserId: string;
  revealDate: Date;
  notes?: string;
  vendor?: string;
  paymentMethod?: string;
  attachedFiles?: string[];
}

export interface GiftTransactionResponseDto {
  id: string;
  description: string;
  amount: number;
  currency: string;
  categoryId: string;
  giftFor: {
    userId: string;
    name: string;
  };
  revealDate: Date;
  isRevealed: boolean;
  revealedAt?: Date;
  createdAt: Date;
  createdBy: {
    userId: string;
    name: string;
  };
}

export interface RevealGiftDto {
  message?: string;
  revealNow?: boolean;
}

@Injectable()
export class GiftModeService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Profile.name)
    private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(CoupleSettings.name)
    private readonly coupleSettingsModel: Model<CoupleSettingsDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly profilesService: ProfilesService
  ) {}

}
