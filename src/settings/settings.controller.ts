import { 
  Controller, 
  Put, 
  Body, 
  UseGuards, 
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiBearerAuth, 
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiSuccessResponse, ApiErrorResponse } from '@common/decorators/api-response.decorator';
import { SettingsService } from './settings.service';
import { UpdatePersonalInfoDto, PersonalInfoResponseDto } from './dto/personal-info.dto';
import { UserResponseDto } from '../users/dto';

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
    type: PersonalInfoResponseDto,
  })
  @ApiErrorResponse(400, 'Validation failed')
  @ApiErrorResponse(404, 'User not found')
  async updatePersonalInfo(
    @CurrentUser() user: any,
    @Body() updatePersonalInfoDto: UpdatePersonalInfoDto,
  ): Promise<PersonalInfoResponseDto> {
    const updatedUser = await this.settingsService.updatePersonalInfo(
      user.id,
      updatePersonalInfoDto,
    );

    return {
      success: true,
      message: 'Personal information updated successfully',
      data: {
        user: updatedUser,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Placeholder endpoints for other settings functionalities
  @Put('display-preferences')
  @ApiOperation({ summary: 'Update display preferences' })
  @ApiResponse({ status: 200, description: 'Display preferences updated successfully' })
  async updateDisplayPreferences(
    @CurrentUser() user: any,
    @Body() displayPreferences: any,
  ) {
    // TODO: Implement display preferences logic
    return {
      success: true,
      message: 'Display preferences updated successfully',
      data: { user: await this.settingsService.getCurrentUser(user.id) },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('notification-preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences updated successfully' })
  async updateNotificationPreferences(
    @CurrentUser() user: any,
    @Body() notificationPreferences: any,
  ) {
    // TODO: Implement notification preferences logic
    return {
      success: true,
      message: 'Notification preferences updated successfully',
      data: { user: await this.settingsService.getCurrentUser(user.id) },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('privacy-preferences')
  @ApiOperation({ summary: 'Update privacy preferences' })
  @ApiResponse({ status: 200, description: 'Privacy preferences updated successfully' })
  async updatePrivacyPreferences(
    @CurrentUser() user: any,
    @Body() privacyPreferences: any,
  ) {
    // TODO: Implement privacy preferences logic
    return {
      success: true,
      message: 'Privacy preferences updated successfully',
      data: { user: await this.settingsService.getCurrentUser(user.id) },
      timestamp: new Date().toISOString(),
    };
  }

  @Put('security')
  @ApiOperation({ summary: 'Update security settings' })
  @ApiResponse({ status: 200, description: 'Security settings updated successfully' })
  async updateSecuritySettings(
    @CurrentUser() user: any,
    @Body() securitySettings: any,
  ) {
    // TODO: Implement security settings logic
    return {
      success: true,
      message: 'Security settings updated successfully',
      data: { user: await this.settingsService.getCurrentUser(user.id) },
      timestamp: new Date().toISOString(),
    };
  }
}