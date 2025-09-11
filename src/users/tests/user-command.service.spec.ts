import {Test, TestingModule} from '@nestjs/testing';
import {getModelToken} from '@nestjs/mongoose';
import {Model, Types} from 'mongoose';
import {ConflictException, InternalServerErrorException} from '@nestjs/common';
import {UserCommandService} from '../services/user-command.service';
import {User, UserDocument} from '../schemas/user.schema';
import {CreateUserDto} from '../dto/create-user.dto';

describe('UserCommandService', () => {
  let service: UserCommandService;

  const mockCreateUserDto: CreateUserDto = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    password: 'password123'
  };

  const mockUser = {
    _id: new Types.ObjectId().toString(),
    ...mockCreateUserDto,
    email: mockCreateUserDto.email.toLowerCase(),
    isActive: true,
    status: 'pending_verification',
    profiles: [],
    accounts: [],
    refreshTokens: [],
    save: jest.fn()
  };

  const mockSave = jest.fn();
  const mockUserConstructor = jest.fn().mockImplementation(userData => ({
    ...userData,
    save: mockSave
  }));

  const mockUserModel = mockUserConstructor;
  mockUserModel.findByIdAndUpdate = jest.fn();
  mockUserModel.findByIdAndDelete = jest.fn();

  beforeEach(async () => {
    // Reset mock implementations first
    mockSave.mockReset();
    mockUserConstructor.mockClear();
    mockUserConstructor.mockImplementation(userData => ({
      ...userData,
      save: mockSave
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserCommandService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel
        }
      ]
    }).compile();

    service = module.get<UserCommandService>(UserCommandService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const expectedUser = {...mockUser, email: mockCreateUserDto.email.toLowerCase()};
      mockSave.mockResolvedValue(expectedUser);

      const result = await service.create(mockCreateUserDto);

      expect(mockUserConstructor).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.email).toBe(mockCreateUserDto.email.toLowerCase());
    });

    it('should hash password if provided', async () => {
      const userWithPassword = {...mockCreateUserDto, password: 'plainPassword'};
      mockSave.mockResolvedValue(mockUser);

      mockUserConstructor.mockImplementation(userData => {
        expect(userData.password).not.toBe('plainPassword');
        expect(userData.password).toBeDefined();
        return {...userData, save: mockSave};
      });

      await service.create(userWithPassword);

      expect(mockUserConstructor).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate email', async () => {
      const duplicateError = {code: 11000};
      mockSave.mockRejectedValue(duplicateError);

      await expect(service.create(mockCreateUserDto)).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException for other errors', async () => {
      const genericError = new Error('Database connection error');
      mockSave.mockRejectedValue(genericError);

      await expect(service.create(mockCreateUserDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createOAuthUser', () => {
    const mockOAuthData = {
      email: 'oauth@example.com',
      firstName: 'OAuth',
      lastName: 'User',
      oauthProvider: 'google',
      oauthProviderId: '123456789',
      isEmailVerified: true
    };

    it('should create OAuth user successfully', async () => {
      const oauthUser = {
        ...mockUser,
        email: mockOAuthData.email.toLowerCase(),
        firstName: mockOAuthData.firstName,
        lastName: mockOAuthData.lastName,
        oauthProvider: mockOAuthData.oauthProvider,
        oauthProviderId: mockOAuthData.oauthProviderId,
        password: undefined
      };
      mockSave.mockResolvedValue(oauthUser);

      const result = await service.createOAuthUser(mockOAuthData);

      expect(mockUserConstructor).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(oauthUser);
    });

    it('should create OAuth user without password', async () => {
      const oauthUser = {...mockUser};
      mockSave.mockResolvedValue(oauthUser);

      mockUserConstructor.mockImplementation(userData => {
        expect(userData.password).toBeUndefined();
        return {...userData, save: mockSave};
      });

      await service.createOAuthUser(mockOAuthData);

      expect(mockUserConstructor).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const userId = new Types.ObjectId().toString();
      const updateData = {firstName: 'Updated'};
      const updatedUser = {...mockUser, ...updateData};

      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedUser)
      });

      const result = await service.update(userId, updateData);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, updateData, {new: true});
      expect(result).toEqual(updatedUser);
    });

    it('should hash password when updating password', async () => {
      const userId = new Types.ObjectId().toString();
      const updateData = {password: 'newPassword'};

      mockUserModel.findByIdAndUpdate.mockImplementation((id, data, _options) => {
        expect(data.password).not.toBe('newPassword');
        expect(data.password).toBeDefined();
        return {
          exec: jest.fn().mockResolvedValue(mockUser)
        };
      });

      await service.update(userId, updateData);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate email on update', async () => {
      const userId = new Types.ObjectId().toString();
      const updateData = {email: 'duplicate@example.com'};
      const duplicateError = {code: 11000};

      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(duplicateError)
      });

      await expect(service.update(userId, updateData)).rejects.toThrow(ConflictException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete user successfully', async () => {
      const userId = new Types.ObjectId().toString();
      const deactivatedUser = {...mockUser, isActive: false, status: 'deactivated'};

      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deactivatedUser)
      });

      const result = await service.softDelete(userId);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {isActive: false, status: 'deactivated'}, {new: true});
      expect(result).toEqual(deactivatedUser);
    });
  });

  describe('hardDelete', () => {
    it('should hard delete user successfully', async () => {
      const userId = new Types.ObjectId().toString();

      mockUserModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await service.hardDelete(userId);

      expect(mockUserModel.findByIdAndDelete).toHaveBeenCalledWith(userId);
      expect(result).toBe(true);
    });

    it('should return false if user not found for deletion', async () => {
      const userId = new Types.ObjectId().toString();

      mockUserModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      const result = await service.hardDelete(userId);

      expect(result).toBe(false);
    });
  });

  describe('verifyEmail', () => {
    it('should verify user email successfully', async () => {
      const userId = new Types.ObjectId().toString();
      const verifiedUser = {...mockUser, isEmailVerified: true, status: 'active'};

      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(verifiedUser)
      });

      const result = await service.verifyEmail(userId);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {isEmailVerified: true, status: 'active'}, {new: true});
      expect(result).toEqual(verifiedUser);
    });
  });

  describe('addRefreshToken', () => {
    it('should add refresh token to user', async () => {
      const userId = new Types.ObjectId().toString();
      const refreshToken = 'refresh_token_123';

      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser)
      });

      await service.addRefreshToken(userId, refreshToken);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        $push: {refreshTokens: refreshToken}
      });
    });
  });

  describe('removeRefreshToken', () => {
    it('should remove refresh token from user', async () => {
      const userId = new Types.ObjectId().toString();
      const refreshToken = 'refresh_token_123';

      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser)
      });

      await service.removeRefreshToken(userId, refreshToken);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        $pull: {refreshTokens: refreshToken}
      });
    });
  });

  describe('clearRefreshTokens', () => {
    it('should clear all refresh tokens', async () => {
      const userId = new Types.ObjectId().toString();

      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser)
      });

      await service.clearRefreshTokens(userId);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        refreshTokens: []
      });
    });
  });
});
