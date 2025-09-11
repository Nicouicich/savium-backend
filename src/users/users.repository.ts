import {Injectable} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {FilterQuery, Model, UpdateQuery} from 'mongoose';
import {User, UserDocument} from './schemas/user.schema';
import {CreateUserDto} from './dto';
import {PaginationDto, PaginationHelper} from '@common/utils/pagination.util';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const user = new this.userModel(createUserDto);
    return user.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+password').exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({email}).exec();
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({email}).select('+password').exec();
  }

  async findAll(paginationDto: PaginationDto, filters?: FilterQuery<UserDocument>) {
    const {skip, limit, sort} = PaginationHelper.createMongoosePaginationOptions(paginationDto);

    const query = filters ? this.userModel.find(filters) : this.userModel.find();

    const [users, total] = await Promise.all([
      query
        .skip(skip)
        .limit(limit)
        .sort(sort as any)
        .exec(),
      this.userModel.countDocuments(filters || {}).exec()
    ]);

    return PaginationHelper.createPaginatedResult(users, paginationDto.page || 1, paginationDto.limit || 10, total);
  }

  async updateById(id: string, updateUserDto: UpdateQuery<UserDocument>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, updateUserDto, {new: true}).exec();
  }

  async deleteById(id: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, {password: hashedPassword}).exec();
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, {lastLoginAt: new Date()}).exec();
  }

  async addRefreshToken(id: string, refreshToken: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, {$push: {refreshTokens: refreshToken}}).exec();
  }

  async removeRefreshToken(id: string, refreshToken: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, {$pull: {refreshTokens: refreshToken}}).exec();
  }

  async clearAllRefreshTokens(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, {refreshTokens: []}).exec();
  }

  async verifyEmail(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        isEmailVerified: true,
        emailVerificationToken: null
      })
      .exec();
  }

  async setEmailVerificationToken(id: string, token: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, {emailVerificationToken: token}).exec();
  }

  async setPasswordResetToken(id: string, token: string, expires: Date): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        passwordResetToken: token,
        passwordResetExpires: expires
      })
      .exec();
  }

  async clearPasswordResetToken(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        passwordResetToken: null,
        passwordResetExpires: null
      })
      .exec();
  }

  async countUsers(filters?: FilterQuery<UserDocument>): Promise<number> {
    return this.userModel.countDocuments(filters || {}).exec();
  }

  // OAuth-related methods
  async findByOAuthProvider(provider: string, providerId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        oauthProvider: provider,
        oauthProviderId: providerId
      })
      .exec();
  }

  async updateOAuthInfo(
    id: string,
    oauthInfo: {
      provider: string;
      providerId: string;
      isEmailVerified: boolean;
    }
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        oauthProvider: oauthInfo.provider,
        oauthProviderId: oauthInfo.providerId,
        isEmailVerified: oauthInfo.isEmailVerified
      })
      .exec();
  }

  async updateAvatar(id: string, avatar: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, {avatar}).exec();
  }

  async removeOAuthInfo(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        $unset: {
          oauthProvider: 1,
          oauthProviderId: 1
        }
      })
      .exec();
  }
}
