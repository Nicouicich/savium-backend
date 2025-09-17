import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';
import { PaginationDto } from '@common/utils/pagination.util';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/constants/user-roles';
import { ApiErrorResponse, ApiPaginatedResponse, ApiSuccessResponse } from '@common/decorators/api-response.decorator';
import type { UserForJWT } from './index';
import { UserMapper } from './index';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiSuccessResponse(UserResponseDto, 'User created successfully')
  @ApiErrorResponse(400, 'Validation failed')
  @ApiErrorResponse(409, 'User already exists')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return user.toJSON() as UserResponseDto;
  }

  @Get()
  @ApiOperation({ summary: 'Get all users with pagination (Admin only)' })
  @ApiPaginatedResponse(UserResponseDto, 'Users retrieved successfully')
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, example: 'createdAt' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async findAll(@Query() paginationDto: PaginationDto) {
    const result = await this.usersService.findAll(paginationDto);
    return {
      data: result.users.map(user => user.toJSON()),
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        currentPage: paginationDto.page || 1,
        limit: paginationDto.limit || 10
      }
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiSuccessResponse(UserResponseDto, 'User profile retrieved successfully')
  async getProfile(@CurrentUser() user: any): Promise<UserResponseDto> {
    const userData = await this.usersService.findById(user.id);
    if (!userData) {
      throw new NotFoundException('User not found');
    }
    return userData.toJSON() as UserResponseDto;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    schema: {
      properties: {
        totalUsers: { type: 'number' },
        activeUsers: { type: 'number' },
        verifiedUsers: { type: 'number' },
        unverifiedUsers: { type: 'number' }
      }
    }
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getStats() {
    return this.usersService.getUserStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiSuccessResponse(UserResponseDto, 'User retrieved successfully')
  @ApiErrorResponse(404, 'User not found')
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.toJSON() as UserResponseDto;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiSuccessResponse(UserResponseDto, 'Profile updated successfully')
  @ApiErrorResponse(400, 'Validation failed')
  async updateProfile(@CurrentUser() user: UserForJWT, @Body() updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const userData = await this.usersService.findById(user.id);
    if (!userData) {
      throw new NotFoundException('User not found');
    }
    const updatedUser = await this.usersService.update(UserMapper.getMongoId(userData), updateUserDto);
    return updatedUser.toJSON() as UserResponseDto;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user by ID (Admin only)' })
  @ApiSuccessResponse(UserResponseDto, 'User updated successfully')
  @ApiErrorResponse(400, 'Validation failed')
  @ApiErrorResponse(404, 'User not found')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.update(id, updateUserDto);
    return user.toJSON() as UserResponseDto;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiErrorResponse(404, 'User not found')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }
}
