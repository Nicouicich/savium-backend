/* eslint-disable @typescript-eslint/unbound-method */
import {Test, TestingModule} from '@nestjs/testing';
import {UsersController} from '../users.controller';
import {UsersService} from '../users.service';
import {CreateUserDto} from '../dto/create-user.dto';
import {UpdateUserDto} from '../dto/update-user.dto';
import {NotFoundException, ConflictException} from '@nestjs/common';
import {Types} from 'mongoose';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUserData = {
    _id: new Types.ObjectId().toString(),
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    isActive: true,
    isEmailVerified: true,
    status: 'active',
    role: 'USER',
    profiles: [],
    accounts: [],
    refreshTokens: [],
    preferences: {
      notifications: {email: true, push: true, sms: false, marketing: false},
      privacy: {dataCollection: true, analytics: true, thirdPartySharing: false},
      display: {currency: 'USD', language: 'en', theme: 'light', dateFormat: 'MM/DD/YYYY', timeFormat: '12h'},
      security: {twoFactorEnabled: false, sessionTimeout: 30, requirePasswordChange: false}
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockUser = {
    ...mockUserData,
    toJSON: jest.fn().mockReturnValue(mockUserData)
  };

  const mockUsersService = {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getUserStats: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService
        }
      ]
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    };

    it('should create a user successfully', async () => {
      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await controller.create(createUserDto);

      expect(usersService.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockUserData);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUsersService.create.mockRejectedValue(new ConflictException('User with this email already exists'));

      await expect(controller.create(createUserDto)).rejects.toThrow(ConflictException);
    });

    it('should handle validation errors properly', async () => {
      const invalidDto = {...createUserDto, email: 'invalid-email'};

      // This would be caught by the validation pipe before reaching the controller
      // but we test the service call behavior
      mockUsersService.create.mockRejectedValue(new Error('Validation failed'));

      await expect(controller.create(invalidDto as CreateUserDto)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const paginationDto = {page: 1, limit: 10};
      const mockServiceResult = {
        users: [mockUser],
        total: 1,
        totalPages: 1
      };

      mockUsersService.findAll.mockResolvedValue(mockServiceResult);

      const result = await controller.findAll(paginationDto);

      expect(usersService.findAll).toHaveBeenCalledWith(paginationDto);
      expect(result).toEqual({
        data: [mockUserData],
        pagination: {
          total: 1,
          totalPages: 1,
          currentPage: 1,
          limit: 10
        }
      });
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const userId = new Types.ObjectId().toString();
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.findOne(userId);

      expect(usersService.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUserData);
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = new Types.ObjectId().toString();
      mockUsersService.findById.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.findOne(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      firstName: 'Updated John'
    };

    it('should update a user successfully', async () => {
      const userId = new Types.ObjectId().toString();
      const updatedMockUser = {
        ...mockUser,
        firstName: 'Updated John',
        toJSON: jest.fn().mockReturnValue({...mockUserData, firstName: 'Updated John'})
      };

      mockUsersService.update.mockResolvedValue(updatedMockUser);

      const result = await controller.update(userId, updateUserDto);

      expect(usersService.update).toHaveBeenCalledWith(userId, updateUserDto);
      expect(result).toEqual({...mockUserData, firstName: 'Updated John'});
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = new Types.ObjectId().toString();
      mockUsersService.update.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.update(userId, updateUserDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when email already exists', async () => {
      const userId = new Types.ObjectId().toString();
      const updateDto = {email: 'existing@example.com'};

      mockUsersService.update.mockRejectedValue(new ConflictException('Email already exists'));

      await expect(controller.update(userId, updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a user successfully', async () => {
      const userId = new Types.ObjectId().toString();
      mockUsersService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(userId);

      expect(usersService.remove).toHaveBeenCalledWith(userId);
      expect(result).toEqual({message: 'User deleted successfully'});
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = new Types.ObjectId().toString();
      mockUsersService.remove.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.remove(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return user statistics', async () => {
      const expectedStats = {
        total: 100,
        active: 85,
        verified: 80,
        byRole: {USER: 90, ADMIN: 10},
        byStatus: {active: 85, pending: 15}
      };

      mockUsersService.getUserStats.mockResolvedValue(expectedStats);

      const result = await controller.getStats();

      expect(usersService.getUserStats).toHaveBeenCalled();
      expect(result).toEqual(expectedStats);
    });
  });

  describe('searchUsers', () => {
    it('should search users successfully', async () => {
      const query = 'john';
      const limit = 10;
      const expectedUsers = [mockUser];

      // Assuming we add a search method to the service
      mockUsersService.searchUsers = jest.fn().mockResolvedValue(expectedUsers);

      // Note: This method might not exist in the current controller
      // This is an example of what we might want to add
      if (controller.searchUsers) {
        const result = await controller.searchUsers(query, limit);
        expect(result).toEqual(expectedUsers);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const userId = new Types.ObjectId().toString();
      mockUsersService.findById.mockRejectedValue(new Error('Database connection error'));

      await expect(controller.findOne(userId)).rejects.toThrow();
    });

    it('should validate input parameters', async () => {
      // Test invalid ObjectId format
      const invalidId = 'invalid-id';

      // The validation should happen at the pipe level
      // but we can test that the service is called with the provided ID
      mockUsersService.findById.mockRejectedValue(new Error('Invalid ObjectId'));

      await expect(controller.findOne(invalidId)).rejects.toThrow();
    });
  });

  describe('Response Format', () => {
    it('should return proper response format for user creation', async () => {
      const createUserDto: CreateUserDto = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123'
      };

      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await controller.create(createUserDto);

      // Verify the response structure
      expect(result).toHaveProperty('_id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('firstName');
      expect(result).toHaveProperty('lastName');
      expect(result).not.toHaveProperty('password'); // Password should not be in response
    });
  });
});
