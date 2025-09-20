import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, HttpStatus, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import type { UserForJWT } from '../users/types';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { ProfileType } from 'src/financial-profiles/schemas';

@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  private readonly logger = new Logger(ProfilesController.name);

  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new profile' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Profile created successfully',
    type: ProfileResponseDto
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid profile data' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Profile type limit exceeded' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  async create(@Body() createProfileDto: CreateProfileDto, @CurrentUser('id') userId: string): Promise<ProfileResponseDto> {
    this.logger.log('Creating new profile', {
      userId,
      type: createProfileDto.type
    });

    return this.profilesService.create(userId, createProfileDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all profiles for current user' })
  @ApiQuery({ name: 'type', enum: ProfileType, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profiles retrieved successfully',
    type: [ProfileResponseDto]
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  async findAll(@CurrentUser('id') userId: string, @Query('type') type?: ProfileType): Promise<ProfileResponseDto[]> {
    this.logger.log('Getting all profiles for user', {
      userId,
      filterType: type || 'all'
    });

    if (type) {
      return this.profilesService.findByType(userId, type);
    }

    return this.profilesService.findAllByUser(userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get current active profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active profile retrieved successfully',
    type: ProfileResponseDto
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No active profile found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  async getActiveProfile(@CurrentUser() user: UserForJWT): Promise<ProfileResponseDto | null> {
    this.logger.log('Getting active profile', {
      userId: user.id
    });

    // Note: UserForJWT doesn't include activeProfileId, so we pass undefined
    // The service will handle finding the most recent profile
    return this.profilesService.findActiveProfile(user.id, undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific profile by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Profile not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Profile does not belong to user' })
  async findOne(@Param('id') id: string, @CurrentUser('id') userId: string): Promise<ProfileResponseDto> {
    this.logger.log('Getting profile by ID', {
      userId,
      profileId: id
    });

    return this.profilesService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
    type: ProfileResponseDto
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Profile not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid update data' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Profile does not belong to user' })
  async update(@Param('id') id: string, @Body() updateProfileDto: UpdateProfileDto, @CurrentUser('id') userId: string): Promise<ProfileResponseDto> {
    this.logger.log('Updating profile', {
      userId,
      profileId: id,
      updateFields: Object.keys(updateProfileDto)
    });

    return this.profilesService.update(id, userId, updateProfileDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a profile' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Profile archived successfully'
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Profile not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Cannot archive personal profile' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Profile does not belong to user' })
  async archive(@Param('id') id: string, @CurrentUser('id') userId: string): Promise<void> {
    this.logger.log('Archiving profile', {
      userId,
      profileId: id
    });

    return this.profilesService.archive(id, userId);
  }

  @Post(':id/use')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark profile as actively used and update timestamp' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile marked as used successfully'
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Profile not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Profile does not belong to user' })
  async markAsUsed(@Param('id') id: string, @CurrentUser('id') userId: string): Promise<{ message: string }> {
    this.logger.log('Marking profile as used', {
      userId,
      profileId: id
    });

    // Verify profile belongs to user before updating
    await this.profilesService.findOne(id, userId);

    // Update profile's last used timestamp
    await this.profilesService.updateLastUsed(id);

    // TODO: Also update user's activeProfileId in UserService
    // This would require injecting UserService and updating the user document

    return { message: 'Profile marked as used successfully' };
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Get profile statistics for current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile statistics retrieved successfully'
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  async getProfileStats(@CurrentUser('id') userId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    lastUsed: Date | null;
  }> {
    this.logger.log('Getting profile statistics', { userId });

    const profiles = await this.profilesService.findAllByUser(userId);

    const stats = {
      total: profiles.length,
      byType: {} as Record<string, number>,
      lastUsed: null as Date | null
    };

    // Count by type and find most recent usage
    for (const profile of profiles) {
      stats.byType[profile.type] = (stats.byType[profile.type] || 0) + 1;
      if (!stats.lastUsed || profile.lastUsedAt > stats.lastUsed) {
        stats.lastUsed = profile.lastUsedAt;
      }
    }

    return stats;
  }
}
