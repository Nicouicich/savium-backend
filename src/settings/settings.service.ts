import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { UpdatePersonalInfoDto } from './dto/personal-info.dto';
import { CreateTagDto, UpdateTagDto } from './dto/tag.dto';
import { Tag, TagDocument } from './schemas/tag.schema';

@Injectable()
export class SettingsService {
  constructor(
    private readonly usersService: UsersService,
    @InjectModel(Tag.name) private tagModel: Model<TagDocument>
  ) {}

  async updatePersonalInfo(userId: string, updateData: UpdatePersonalInfoDto): Promise<User> {
    return this.usersService.update(userId, updateData);
  }

  async getCurrentUser(userId: string): Promise<User> {
    return this.usersService.findById(userId);
  }

  // Tags management methods
  async createTag(userId: string, createTagDto: CreateTagDto): Promise<Tag> {
    try {
      // Check if tag name already exists for this user
      const existingTag = await this.tagModel.findOne({
        name: createTagDto.name,
        userId: new Types.ObjectId(userId),
        isDeleted: false
      });

      if (existingTag) {
        throw new BadRequestException('A tag with this name already exists');
      }

      const tag = new this.tagModel({
        ...createTagDto,
        userId: new Types.ObjectId(userId),
        profileId: createTagDto.profileId ? new Types.ObjectId(createTagDto.profileId) : undefined
      });

      return await tag.save();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create tag');
    }
  }

  async getTags(userId: string, profileId?: string): Promise<Tag[]> {
    try {
      const filter: any = {
        userId: new Types.ObjectId(userId),
        isDeleted: false,
        isActive: true
      };

      if (profileId) {
        filter.profileId = new Types.ObjectId(profileId);
      }

      return await this.tagModel.find(filter).sort({ usageCount: -1, name: 1 }).exec();
    } catch {
      throw new BadRequestException('Failed to fetch tags');
    }
  }

  async getTagById(userId: string, tagId: string): Promise<Tag> {
    try {
      const tag = await this.tagModel.findOne({
        _id: new Types.ObjectId(tagId),
        userId: new Types.ObjectId(userId),
        isDeleted: false
      });

      if (!tag) {
        throw new NotFoundException('Tag not found');
      }

      return tag;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch tag');
    }
  }

  async updateTag(userId: string, tagId: string, updateTagDto: UpdateTagDto): Promise<Tag> {
    try {
      // Check if tag exists and belongs to user
      const existingTag = await this.getTagById(userId, tagId);

      // If name is being updated, check for duplicates
      if (updateTagDto.name && updateTagDto.name !== existingTag.name) {
        const duplicateTag = await this.tagModel.findOne({
          name: updateTagDto.name,
          userId: new Types.ObjectId(userId),
          _id: { $ne: new Types.ObjectId(tagId) },
          isDeleted: false
        });

        if (duplicateTag) {
          throw new BadRequestException('A tag with this name already exists');
        }
      }

      const updatedTag = await this.tagModel.findByIdAndUpdate(tagId, { $set: updateTagDto }, { new: true });

      if (!updatedTag) {
        throw new NotFoundException('Tag not found');
      }

      return updatedTag;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update tag');
    }
  }

  async deleteTag(userId: string, tagId: string): Promise<void> {
    try {
      // Check if tag exists and belongs to user
      await this.getTagById(userId, tagId);

      // Soft delete the tag
      const result = await this.tagModel.findByIdAndUpdate(tagId, {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false
        }
      });

      if (!result) {
        throw new NotFoundException('Tag not found');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete tag');
    }
  }

  async incrementTagUsage(userId: string, tagId: string): Promise<void> {
    try {
      await this.tagModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(tagId),
          userId: new Types.ObjectId(userId),
          isDeleted: false
        },
        {
          $inc: { usageCount: 1 },
          $set: { lastUsedAt: new Date() }
        }
      );
    } catch (error) {
      // This is a non-critical operation, so we don't throw errors
      console.error('Failed to increment tag usage:', error);
    }
  }
}
