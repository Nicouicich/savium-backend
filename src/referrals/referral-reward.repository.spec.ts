import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { ReferralRewardRepository } from './referral-reward.repository';
import { ReferralReward, ReferralRewardDocument, RewardStatus, RewardType } from './schemas/referral-reward.schema';

describe('ReferralRewardRepository', () => {
  let repository: ReferralRewardRepository;
  let model: Model<ReferralRewardDocument>;

  const mockModel = jest.fn().mockImplementation(data => ({
    save: jest.fn().mockResolvedValue(data),
    ...data
  }));

  // Add static methods to the mock
  Object.assign(mockModel, {
    create: jest.fn(),
    insertMany: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findOneAndDelete: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    bulkWrite: jest.fn(),
    db: {
      startSession: jest.fn()
    }
  });

  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn()
  };

  const mockQuery = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralRewardRepository,
        {
          provide: getModelToken(ReferralReward.name),
          useValue: mockModel
        }
      ]
    }).compile();

    repository = module.get<ReferralRewardRepository>(ReferralRewardRepository);
    model = module.get<Model<ReferralRewardDocument>>(getModelToken(ReferralReward.name));

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a new referral reward', async () => {
      const rewardData = {
        userId: new Types.ObjectId(),
        referredUserId: new Types.ObjectId(),
        rewardType: RewardType.CASH,
        amount: 10,
        currency: 'USD',
        status: RewardStatus.PENDING
      };

      const result = await repository.create(rewardData);

      expect(mockModel).toHaveBeenCalledWith(rewardData);
      expect(result).toEqual(rewardData);
    });
  });

  describe('findById', () => {
    it('should find a reward by id', async () => {
      const rewardId = new Types.ObjectId();
      const mockReward = { _id: rewardId, amount: 10 };

      mockModel.findById.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue(mockReward);

      const result = await repository.findById(rewardId);

      expect(mockModel.findById).toHaveBeenCalledWith(rewardId);
      expect(mockQuery.exec).toHaveBeenCalled();
      expect(result).toEqual(mockReward);
    });
  });

  describe('findByUserId', () => {
    it('should find rewards by user id', async () => {
      const userId = new Types.ObjectId();
      const mockRewards = [
        { _id: new Types.ObjectId(), userId, amount: 10 },
        { _id: new Types.ObjectId(), userId, amount: 20 }
      ];

      mockModel.find.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue(mockRewards);

      const result = await repository.findByUserId(userId);

      expect(mockModel.find).toHaveBeenCalledWith({ userId });
      expect(result).toEqual(mockRewards);
    });

    it('should find rewards by user id with status filter', async () => {
      const userId = new Types.ObjectId();
      const status = RewardStatus.AVAILABLE;
      const mockRewards = [{ _id: new Types.ObjectId(), userId, status, amount: 10 }];

      mockModel.find.mockReturnValue(mockQuery);
      mockQuery.exec.mockResolvedValue(mockRewards);

      const result = await repository.findByUserId(userId, status);

      expect(mockModel.find).toHaveBeenCalledWith({ userId, status });
      expect(result).toEqual(mockRewards);
    });
  });

  describe('updateStatusByIds', () => {
    it('should update status for multiple rewards', async () => {
      const rewardIds = [new Types.ObjectId(), new Types.ObjectId()];
      const status = RewardStatus.REDEEMED;
      const updateResult = { modifiedCount: 2 };

      mockModel.updateMany.mockReturnValue({ exec: jest.fn().mockResolvedValue(updateResult) });

      const result = await repository.updateStatusByIds(rewardIds, status);

      expect(mockModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: rewardIds } },
        expect.objectContaining({
          status,
          updatedAt: expect.any(Date),
          redeemedAt: expect.any(Date)
        })
      );
      expect(result).toEqual({ modifiedCount: 2 });
    });
  });

  describe('getRewardStatsByUserId', () => {
    it('should get reward statistics for a user', async () => {
      const userId = new Types.ObjectId();
      const mockStats = [
        { _id: RewardStatus.AVAILABLE, count: 3, totalAmount: 30 },
        { _id: RewardStatus.REDEEMED, count: 2, totalAmount: 20 }
      ];

      mockModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockStats) });

      const result = await repository.getRewardStatsByUserId(userId);

      expect(mockModel.aggregate).toHaveBeenCalledWith([
        { $match: { userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      expect(result).toEqual(mockStats);
    });
  });

  describe('createReferralReward', () => {
    it('should create a referral reward with proper data transformation', async () => {
      const rewardData = {
        userId: new Types.ObjectId().toString(),
        referredUserId: new Types.ObjectId().toString(),
        rewardType: RewardType.CASH,
        amount: 10,
        currency: 'USD',
        description: 'Test reward'
      };

      const result = await repository.createReferralReward(rewardData);

      expect(mockModel).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          referredUserId: expect.any(Types.ObjectId),
          rewardType: RewardType.CASH,
          amount: 10,
          currency: 'USD',
          status: RewardStatus.PENDING,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      );
    });
  });

  describe('markRewardsAsExpired', () => {
    it('should mark old available rewards as expired when no IDs provided', async () => {
      const updateResult = { modifiedCount: 5 };
      mockModel.updateMany.mockReturnValue({ exec: jest.fn().mockResolvedValue(updateResult) });

      const result = await repository.markRewardsAsExpired();

      expect(mockModel.updateMany).toHaveBeenCalledWith(
        {
          status: RewardStatus.AVAILABLE,
          createdAt: { $lt: expect.any(Date) }
        },
        {
          status: RewardStatus.EXPIRED,
          expiredAt: expect.any(Date),
          updatedAt: expect.any(Date)
        }
      );
      expect(result).toEqual({ modifiedCount: 5 });
    });

    it('should mark specific rewards as expired when IDs provided', async () => {
      const rewardIds = [new Types.ObjectId(), new Types.ObjectId()];
      const updateResult = { modifiedCount: 2 };
      mockModel.updateMany.mockReturnValue({ exec: jest.fn().mockResolvedValue(updateResult) });

      const result = await repository.markRewardsAsExpired(rewardIds);

      expect(mockModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: rewardIds } },
        {
          status: RewardStatus.EXPIRED,
          expiredAt: expect.any(Date),
          updatedAt: expect.any(Date)
        }
      );
      expect(result).toEqual({ modifiedCount: 2 });
    });
  });

  describe('withTransaction', () => {
    it('should execute function within a transaction', async () => {
      const mockTransactionFn = jest.fn().mockResolvedValue('result');

      mockModel.db.startSession.mockResolvedValue(mockSession);

      const result = await repository.withTransaction(mockTransactionFn);

      expect(mockModel.db.startSession).toHaveBeenCalled();
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockTransactionFn).toHaveBeenCalledWith(mockSession);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should abort transaction on error', async () => {
      const error = new Error('Transaction failed');
      const mockTransactionFn = jest.fn().mockRejectedValue(error);

      mockModel.db.startSession.mockResolvedValue(mockSession);

      await expect(repository.withTransaction(mockTransactionFn)).rejects.toThrow(error);

      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
