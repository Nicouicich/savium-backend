import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { CreateTagDto, UpdateTagDto } from './dto/tag.dto';
import { Tag } from './schemas/tag.schema';
import { Types } from 'mongoose';

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: SettingsService;

  const mockUser = {
    id: new Types.ObjectId().toString(),
    email: 'test@example.com'
  };

  const mockTag: Tag & { _id: string; createdAt: Date; updatedAt: Date } = {
    _id: new Types.ObjectId().toString(),
    name: 'Work',
    color: '#3B82F6',
    description: 'Work-related transactions',
    userId: new Types.ObjectId(mockUser.id),
    profileId: undefined,
    isActive: true,
    usageCount: 0,
    lastUsedAt: undefined,
    metadata: {},
    isDeleted: false,
    deletedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date()
  } as any;

  const mockSettingsService = {
    getTags: jest.fn(),
    createTag: jest.fn(),
    updateTag: jest.fn(),
    deleteTag: jest.fn(),
    getCurrentUser: jest.fn(),
    updatePersonalInfo: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: mockSettingsService
        }
      ]
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    service = module.get<SettingsService>(SettingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTags', () => {
    it('should return formatted tags successfully', async () => {
      const mockTags = [mockTag];
      mockSettingsService.getTags.mockResolvedValue(mockTags);

      const result = await controller.getTags(mockUser);

      expect(mockSettingsService.getTags).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        success: true,
        message: 'Tags retrieved successfully',
        data: [
          {
            id: mockTag._id,
            name: mockTag.name,
            color: mockTag.color,
            description: mockTag.description,
            userId: mockTag.userId.toString(),
            profileId: undefined,
            isActive: mockTag.isActive,
            usageCount: mockTag.usageCount,
            lastUsedAt: mockTag.lastUsedAt,
            createdAt: mockTag.createdAt,
            updatedAt: mockTag.updatedAt
          }
        ],
        timestamp: expect.any(String)
      });
    });

    it('should handle service errors', async () => {
      mockSettingsService.getTags.mockRejectedValue(new BadRequestException('Failed to fetch tags'));

      await expect(controller.getTags(mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createTag', () => {
    it('should create tag successfully', async () => {
      const createTagDto: CreateTagDto = {
        name: 'Work',
        color: '#3B82F6',
        description: 'Work-related transactions'
      };

      mockSettingsService.createTag.mockResolvedValue(mockTag);

      const result = await controller.createTag(mockUser, createTagDto);

      expect(mockSettingsService.createTag).toHaveBeenCalledWith(mockUser.id, createTagDto);
      expect(result).toEqual({
        success: true,
        message: 'Tag created successfully',
        data: {
          id: mockTag._id,
          name: mockTag.name,
          color: mockTag.color,
          description: mockTag.description,
          userId: mockTag.userId.toString(),
          profileId: undefined,
          isActive: mockTag.isActive,
          usageCount: mockTag.usageCount,
          lastUsedAt: mockTag.lastUsedAt,
          createdAt: mockTag.createdAt,
          updatedAt: mockTag.updatedAt
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle duplicate tag name error', async () => {
      const createTagDto: CreateTagDto = {
        name: 'Work',
        color: '#3B82F6'
      };

      mockSettingsService.createTag.mockRejectedValue(new BadRequestException('A tag with this name already exists'));

      await expect(controller.createTag(mockUser, createTagDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateTag', () => {
    const tagId = mockTag._id;

    it('should update tag successfully', async () => {
      const updateTagDto: UpdateTagDto = {
        name: 'Updated Work',
        color: '#10B981'
      };

      const updatedTag = { ...mockTag, ...updateTagDto };
      mockSettingsService.updateTag.mockResolvedValue(updatedTag);

      const result = await controller.updateTag(mockUser, tagId, updateTagDto);

      expect(mockSettingsService.updateTag).toHaveBeenCalledWith(mockUser.id, tagId, updateTagDto);
      expect(result).toEqual({
        success: true,
        message: 'Tag updated successfully',
        data: {
          id: updatedTag._id,
          name: updatedTag.name,
          color: updatedTag.color,
          description: updatedTag.description,
          userId: updatedTag.userId.toString(),
          profileId: undefined,
          isActive: updatedTag.isActive,
          usageCount: updatedTag.usageCount,
          lastUsedAt: updatedTag.lastUsedAt,
          createdAt: updatedTag.createdAt,
          updatedAt: updatedTag.updatedAt
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle tag not found error', async () => {
      const updateTagDto: UpdateTagDto = {
        name: 'Updated Work'
      };

      mockSettingsService.updateTag.mockRejectedValue(new NotFoundException('Tag not found'));

      await expect(controller.updateTag(mockUser, tagId, updateTagDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTag', () => {
    const tagId = mockTag._id;

    it('should delete tag successfully', async () => {
      mockSettingsService.deleteTag.mockResolvedValue(undefined);

      const result = await controller.deleteTag(mockUser, tagId);

      expect(mockSettingsService.deleteTag).toHaveBeenCalledWith(mockUser.id, tagId);
      expect(result).toEqual({
        success: true,
        message: 'Tag deleted successfully',
        timestamp: expect.any(String)
      });
    });

    it('should handle tag not found error', async () => {
      mockSettingsService.deleteTag.mockRejectedValue(new NotFoundException('Tag not found'));

      await expect(controller.deleteTag(mockUser, tagId)).rejects.toThrow(NotFoundException);
    });
  });
});
