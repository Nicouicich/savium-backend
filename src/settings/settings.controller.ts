import { ApiErrorResponse } from '@common/decorators/api-response.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Body, ClassSerializerInterceptor, Controller, Delete, Get, Param, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PersonalInfoResponseDto, UpdatePersonalInfoDto } from './dto/personal-info.dto';
import { CreateTagDto, TagCreatedResponseDto, TagsListResponseDto, UpdateTagDto } from './dto/tag.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(ClassSerializerInterceptor)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Put('personal-info')
  @ApiOperation({ summary: 'Update personal information' })
  @ApiResponse({
    status: 200,
    description: 'Personal information updated successfully',
    type: PersonalInfoResponseDto
  })
  @ApiErrorResponse(400, 'Validation failed')
  @ApiErrorResponse(404, 'User not found')
  async updatePersonalInfo(@CurrentUser() user: any, @Body() updatePersonalInfoDto: UpdatePersonalInfoDto): Promise<PersonalInfoResponseDto> {
    const updatedUser = await this.settingsService.updatePersonalInfo(user.id, updatePersonalInfoDto);

    // Convert to plain object to avoid serialization issues
    const plainUser = JSON.parse(JSON.stringify(updatedUser));

    return {
      success: true,
      message: 'Personal information updated successfully',
      data: {
        user: {
          id: plainUser._id || plainUser.id,
          firstName: plainUser.firstName,
          lastName: plainUser.lastName,
          email: plainUser.email,
          role: plainUser.role,
          isActive: plainUser.isActive,
          isEmailVerified: plainUser.isEmailVerified,
          status: plainUser.status,
          createdAt: plainUser.createdAt,
          updatedAt: plainUser.updatedAt
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  // Placeholder endpoints for other settings functionalities
  @Put('display-preferences')
  @ApiOperation({ summary: 'Update display preferences' })
  @ApiResponse({ status: 200, description: 'Display preferences updated successfully' })
  async updateDisplayPreferences(@CurrentUser() user: any) {
    // TODO: Implement display preferences logic
    return {
      success: true,
      message: 'Display preferences updated successfully',
      data: { user: await this.settingsService.getCurrentUser(user.id) },
      timestamp: new Date().toISOString()
    };
  }

  @Put('notification-preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences updated successfully' })
  async updateNotificationPreferences(@CurrentUser() user: any) {
    // TODO: Implement notification preferences logic
    return {
      success: true,
      message: 'Notification preferences updated successfully',
      data: { user: await this.settingsService.getCurrentUser(user.id) },
      timestamp: new Date().toISOString()
    };
  }

  @Put('privacy-preferences')
  @ApiOperation({ summary: 'Update privacy preferences' })
  @ApiResponse({ status: 200, description: 'Privacy preferences updated successfully' })
  async updatePrivacyPreferences(@CurrentUser() user: any) {
    // TODO: Implement privacy preferences logic
    return {
      success: true,
      message: 'Privacy preferences updated successfully',
      data: { user: await this.settingsService.getCurrentUser(user.id) },
      timestamp: new Date().toISOString()
    };
  }

  @Put('security')
  @ApiOperation({ summary: 'Update security settings' })
  @ApiResponse({ status: 200, description: 'Security settings updated successfully' })
  async updateSecuritySettings(@CurrentUser() user: any) {
    // TODO: Implement security settings logic
    return {
      success: true,
      message: 'Security settings updated successfully',
      data: { user: await this.settingsService.getCurrentUser(user.id) },
      timestamp: new Date().toISOString()
    };
  }

  // Tags management endpoints
  @Get('tags')
  @ApiOperation({ summary: 'Get all user tags' })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    type: TagsListResponseDto
  })
  @ApiErrorResponse(400, 'Failed to fetch tags')
  async getTags(@CurrentUser() user: any): Promise<TagsListResponseDto> {
    const tags = await this.settingsService.getTags(user.id);

    const formattedTags = tags.map(tag => ({
      id: (tag as any)._id?.toString() || (tag as any).id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      userId: tag.userId.toString(),
      profileId: tag.profileId?.toString(),
      isActive: tag.isActive,
      usageCount: tag.usageCount,
      lastUsedAt: tag.lastUsedAt,
      createdAt: (tag as any).createdAt,
      updatedAt: (tag as any).updatedAt
    }));

    return {
      success: true,
      message: 'Tags retrieved successfully',
      data: formattedTags,
      timestamp: new Date().toISOString()
    };
  }

  @Post('tags')
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiResponse({
    status: 201,
    description: 'Tag created successfully',
    type: TagCreatedResponseDto
  })
  @ApiErrorResponse(400, 'Validation failed or tag name already exists')
  async createTag(@CurrentUser() user: any, @Body() createTagDto: CreateTagDto): Promise<TagCreatedResponseDto> {
    const tag = await this.settingsService.createTag(user.id, createTagDto);

    const formattedTag = {
      id: (tag as any)._id?.toString() || (tag as any).id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      userId: tag.userId.toString(),
      profileId: tag.profileId?.toString(),
      isActive: tag.isActive,
      usageCount: tag.usageCount,
      lastUsedAt: tag.lastUsedAt,
      createdAt: (tag as any).createdAt,
      updatedAt: (tag as any).updatedAt
    };

    return {
      success: true,
      message: 'Tag created successfully',
      data: formattedTag,
      timestamp: new Date().toISOString()
    };
  }

  @Put('tags/:id')
  @ApiOperation({ summary: 'Update an existing tag' })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({
    status: 200,
    description: 'Tag updated successfully',
    type: TagCreatedResponseDto
  })
  @ApiErrorResponse(400, 'Validation failed or tag name already exists')
  @ApiErrorResponse(404, 'Tag not found')
  async updateTag(@CurrentUser() user: any, @Param('id') tagId: string, @Body() updateTagDto: UpdateTagDto): Promise<TagCreatedResponseDto> {
    const tag = await this.settingsService.updateTag(user.id, tagId, updateTagDto);

    const formattedTag = {
      id: (tag as any)._id?.toString() || (tag as any).id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      userId: tag.userId.toString(),
      profileId: tag.profileId?.toString(),
      isActive: tag.isActive,
      usageCount: tag.usageCount,
      lastUsedAt: tag.lastUsedAt,
      createdAt: (tag as any).createdAt,
      updatedAt: (tag as any).updatedAt
    };

    return {
      success: true,
      message: 'Tag updated successfully',
      data: formattedTag,
      timestamp: new Date().toISOString()
    };
  }

  @Delete('tags/:id')
  @ApiOperation({ summary: 'Delete a tag' })
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiResponse({
    status: 200,
    description: 'Tag deleted successfully'
  })
  @ApiErrorResponse(404, 'Tag not found')
  async deleteTag(@CurrentUser() user: any, @Param('id') tagId: string) {
    await this.settingsService.deleteTag(user.id, tagId);

    return {
      success: true,
      message: 'Tag deleted successfully',
      timestamp: new Date().toISOString()
    };
  }
}
