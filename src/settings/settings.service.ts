import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UpdatePersonalInfoDto } from './dto/personal-info.dto';
import { User } from '../users/schemas/user.schema';

@Injectable()
export class SettingsService {
  constructor(private readonly usersService: UsersService) {}

  async updatePersonalInfo(userId: string, updateData: UpdatePersonalInfoDto): Promise<User> {
    return this.usersService.update(userId, updateData);
  }

  async getCurrentUser(userId: string): Promise<User> {
    return this.usersService.findById(userId);
  }
}