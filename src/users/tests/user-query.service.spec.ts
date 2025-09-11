import {Test, TestingModule} from '@nestjs/testing';
import {getModelToken} from '@nestjs/mongoose';
import {Model, Types} from 'mongoose';
import {UserQueryService} from '../services/user-query.service';
import {User, UserDocument} from '../schemas/user.schema';
import {UserProfile, UserProfileDocument} from '../schemas/user-profile.schema';

describe('UserQueryService', () => {
  let service: UserQueryService;

  const mockUser = {
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

  const mockUserModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn().mockReturnValue({
      exec: jest.fn()
    }),
    exec: jest.fn()
  };

  const mockUserProfileModel = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserQueryService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel
        },
        {
          provide: getModelToken(UserProfile.name),
          useValue: mockUserProfileModel
        }
      ]
    }).compile();

    service = module.get<UserQueryService>(UserQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const userId = new Types.ObjectId().toString();
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await service.findById(userId);

      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it('should find user by id with population', async () => {
      const userId = new Types.ObjectId().toString();
      const populate = ['activeProfile', 'profiles'];

      // Mock aggregate method since findById uses aggregate when populate is provided
      mockUserModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockUser])
      });

      const result = await service.findById(userId, populate);

      expect(mockUserModel.aggregate).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({$match: expect.any(Object)})]));
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      const userId = new Types.ObjectId().toString();
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      const result = await service.findById(userId);

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const email = 'john.doe@example.com';
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await service.findByEmail(email);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({email: email.toLowerCase()});
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      const email = 'notfound@example.com';
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      const result = await service.findByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe('findByOAuthProvider', () => {
    it('should find user by OAuth provider', async () => {
      const provider = 'google';
      const providerId = '123456789';

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await service.findByOAuthProvider(provider, providerId);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        oauthProvider: provider,
        oauthProviderId: providerId
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findWithPagination', () => {
    it('should return paginated users', async () => {
      const mockUsers = [mockUser];
      const total = 1;
      const page = 1;
      const limit = 10;

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUsers)
      };

      mockUserModel.find.mockReturnValue(mockQuery);
      mockUserModel.countDocuments.mockResolvedValue(total);

      const result = await service.findWithPagination({}, page, limit);

      expect(result).toEqual({
        users: mockUsers,
        total,
        totalPages: 1
      });
    });
  });

  describe('emailExists', () => {
    it('should return true if email exists', async () => {
      const email = 'john.doe@example.com';
      mockUserModel.countDocuments.mockResolvedValue(1);

      const result = await service.emailExists(email);

      expect(mockUserModel.countDocuments).toHaveBeenCalledWith({
        email: email.toLowerCase()
      });
      expect(result).toBe(true);
    });

    it('should return false if email does not exist', async () => {
      const email = 'notfound@example.com';
      mockUserModel.countDocuments.mockResolvedValue(0);

      const result = await service.emailExists(email);

      expect(result).toBe(false);
    });
  });

  describe('searchUsers', () => {
    it('should search users by query', async () => {
      const query = 'john';
      const limit = 10;
      const mockUsers = [mockUser];

      const mockQuery = {
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUsers)
      };

      mockUserModel.find.mockReturnValue(mockQuery);

      const result = await service.searchUsers(query, limit);

      expect(mockUserModel.find).toHaveBeenCalledWith({
        $or: [{firstName: new RegExp(query, 'i')}, {lastName: new RegExp(query, 'i')}, {email: new RegExp(query, 'i')}],
        isActive: true
      });
      expect(mockQuery.limit).toHaveBeenCalledWith(limit);
      expect(result).toEqual(mockUsers);
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockRoleStats = [{_id: 'USER', count: 5}];
      const mockStatusStats = [{_id: 'active', count: 3}];

      mockUserModel.countDocuments.mockImplementation(filter => {
        if (!filter) return Promise.resolve(10);
        if (filter.isActive) return Promise.resolve(8);
        if (filter.isEmailVerified) return Promise.resolve(7);
        return Promise.resolve(0);
      });

      mockUserModel.aggregate.mockImplementation(pipeline => {
        if (pipeline[0].$group._id === '$role') {
          return Promise.resolve(mockRoleStats);
        }
        if (pipeline[0].$group._id === '$status') {
          return Promise.resolve(mockStatusStats);
        }
        return Promise.resolve([]);
      });

      const result = await service.getUserStats();

      expect(result).toEqual({
        total: 10,
        active: 8,
        verified: 7,
        byRole: {USER: 5},
        byStatus: {active: 3}
      });
    });
  });
});
