# 🎯 PRECISION-ENGINEERED PROMPT: NestJS Repository Pattern Implementation

## ROLE & IDENTITY
You are a **Senior Backend Architecture Engineer** specializing in NestJS, MongoDB/Mongoose, and clean architecture patterns. You have 10+ years of experience refactoring enterprise-scale applications and are an expert in SOLID principles, particularly the Single Responsibility Principle and Dependency Inversion Principle.

## CONTEXT & SITUATION
You are working on a critical architectural refactoring of a NestJS backend application that currently violates clean architecture principles. Services are directly importing and using Mongoose schemas/models, creating tight coupling between business logic and data access layers.

**Current State (ANTI-PATTERN):**
- Services directly inject Models via `@InjectModel(Schema.name)`
- Business logic is mixed with database queries
- No abstraction layer between services and database
- Testing is difficult due to tight coupling
- Database vendor lock-in

**Target State (CLEAN ARCHITECTURE):**
- Repository Pattern: Only repositories interact with schemas/models
- Services contain pure business logic
- Clear separation of concerns
- Easy to test with mock repositories
- Database-agnostic business layer

## TASK: SYSTEMATIC REPOSITORY PATTERN IMPLEMENTATION

### PHASE 1: COMPREHENSIVE AUDIT (30 minutes)
```typescript
// AUDIT CHECKLIST - Execute in this exact order:

1. Database Schema Discovery:
   - Run: find . -name "*.schema.ts" -type f | sort
   - Document every schema file location
   - Note schema names and their modules

2. Service Analysis:
   - Run: grep -r "@InjectModel" --include="*.service.ts" .
   - Run: grep -r "Model<" --include="*.service.ts" .
   - Run: grep -r "\.findOne\|\.findById\|\.find\|\.create\|\.save\|\.updateOne\|\.deleteOne" --include="*.service.ts" .
   - Create a matrix: [Service Name] -> [Schemas Used] -> [Operations Performed]

3. Existing Repository Assessment:
   - Identify modules that already have repositories
   - Analyze their implementation patterns
   - Note inconsistencies to fix

4. Module Dependency Mapping:
   - Map inter-module dependencies
   - Identify shared schemas across modules
   - Document circular dependency risks
```

### PHASE 2: REPOSITORY CREATION (2 hours)

For EACH module that needs a repository, create using this EXACT template:

```typescript
// src/[module]/[module].repository.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery, UpdateQuery, QueryOptions, ClientSession } from 'mongoose';
import {
  [Schema],
  [Schema]Document
} from './schemas/[schema].schema';

@Injectable()
export class [Module]Repository {
  private readonly logger = new Logger([Module]Repository.name);

  constructor(
    @InjectModel([Schema].name) private readonly model: Model<[Schema]Document>
  ) {}

  // ============= CREATE OPERATIONS =============
  async create(data: Partial<[Schema]>): Promise<[Schema]Document> {
    const entity = new this.model(data);
    return await entity.save();
  }

  async createMany(data: Partial<[Schema]>[]): Promise<[Schema]Document[]> {
    return await this.model.insertMany(data);
  }

  // ============= READ OPERATIONS =============
  async findById(id: string | Types.ObjectId): Promise<[Schema]Document | null> {
    return await this.model.findById(id).exec();
  }

  async findOne(filter: FilterQuery<[Schema]Document>): Promise<[Schema]Document | null> {
    return await this.model.findOne(filter).exec();
  }

  async find(
    filter: FilterQuery<[Schema]Document> = {},
    options?: QueryOptions
  ): Promise<[Schema]Document[]> {
    const query = this.model.find(filter);

    if (options?.sort) query.sort(options.sort);
    if (options?.limit) query.limit(options.limit);
    if (options?.skip) query.skip(options.skip);
    if (options?.populate) query.populate(options.populate);

    return await query.exec();
  }

  async findWithPagination(
    filter: FilterQuery<[Schema]Document> = {},
    page: number = 1,
    limit: number = 10,
    sort: any = { createdAt: -1 }
  ): Promise<{
    data: [Schema]Document[];
    total: number;
    page: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.find(filter, { skip, limit, sort }),
      this.count(filter)
    ]);

    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  // ============= UPDATE OPERATIONS =============
  async updateById(
    id: string | Types.ObjectId,
    update: UpdateQuery<[Schema]Document>,
    options?: QueryOptions
  ): Promise<[Schema]Document | null> {
    return await this.model.findByIdAndUpdate(
      id,
      update,
      { new: true, runValidators: true, ...options }
    ).exec();
  }

  async updateOne(
    filter: FilterQuery<[Schema]Document>,
    update: UpdateQuery<[Schema]Document>,
    options?: QueryOptions
  ): Promise<[Schema]Document | null> {
    return await this.model.findOneAndUpdate(
      filter,
      update,
      { new: true, runValidators: true, ...options }
    ).exec();
  }

  async updateMany(
    filter: FilterQuery<[Schema]Document>,
    update: UpdateQuery<[Schema]Document>
  ): Promise<{ modifiedCount: number }> {
    const result = await this.model.updateMany(filter, update).exec();
    return { modifiedCount: result.modifiedCount || 0 };
  }

  // ============= DELETE OPERATIONS =============
  async deleteById(id: string | Types.ObjectId): Promise<[Schema]Document | null> {
    return await this.model.findByIdAndDelete(id).exec();
  }

  async deleteOne(filter: FilterQuery<[Schema]Document>): Promise<[Schema]Document | null> {
    return await this.model.findOneAndDelete(filter).exec();
  }

  async deleteMany(filter: FilterQuery<[Schema]Document>): Promise<{ deletedCount: number }> {
    const result = await this.model.deleteMany(filter).exec();
    return { deletedCount: result.deletedCount || 0 };
  }

  // ============= AGGREGATION OPERATIONS =============
  async aggregate(pipeline: any[]): Promise<any[]> {
    return await this.model.aggregate(pipeline).exec();
  }

  // ============= UTILITY OPERATIONS =============
  async count(filter: FilterQuery<[Schema]Document> = {}): Promise<number> {
    return await this.model.countDocuments(filter).exec();
  }

  async exists(filter: FilterQuery<[Schema]Document>): Promise<boolean> {
    const count = await this.count(filter);
    return count > 0;
  }

  // ============= TRANSACTION SUPPORT =============
  async withTransaction<T>(
    fn: (session: ClientSession) => Promise<T>
  ): Promise<T> {
    const session = await this.model.db.startSession();
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ============= BULK OPERATIONS =============
  async bulkWrite(operations: any[]): Promise<any> {
    return await this.model.bulkWrite(operations);
  }

  // ============= SPECIAL OPERATIONS (Add module-specific methods) =============
  // Example for user module:
  // async findByEmail(email: string): Promise<UserDocument | null> {
  //   return await this.findOne({ email: email.toLowerCase() });
  // }
}
```

### PHASE 3: SERVICE REFACTORING (3 hours)

For EACH service file, apply this transformation pattern:

**BEFORE (Anti-pattern):**
```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Profile.name) private profileModel: Model<ProfileDocument>
  ) {}

  async createUser(data: CreateUserDto) {
    const user = new this.userModel(data);
    await user.save();

    const profile = new this.profileModel({ userId: user._id });
    await profile.save();

    return user;
  }

  async findByEmail(email: string) {
    return await this.userModel.findOne({ email }).exec();
  }
}
```

**AFTER (Clean Architecture):**
```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly profileRepository: ProfileRepository
  ) {}

  async createUser(data: CreateUserDto) {
    // Pure business logic - validation, transformation
    const normalizedEmail = data.email.toLowerCase();

    // Check business rules
    const existingUser = await this.userRepository.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Delegate data access to repository
    const user = await this.userRepository.create({
      ...data,
      email: normalizedEmail
    });

    // Create related entities through their repositories
    await this.profileRepository.create({
      userId: user._id
    });

    // Business logic: send welcome email, emit events, etc.
    this.logger.log(`User created: ${user._id}`);

    return user;
  }

  async findByEmail(email: string) {
    // Business logic stays in service
    const normalizedEmail = email.toLowerCase();

    // Data access through repository
    return await this.userRepository.findOne({
      email: normalizedEmail
    });
  }
}
```

### PHASE 4: MODULE CONFIGURATION (1 hour)

Update EVERY module file to properly wire repositories:

```typescript
// src/[module]/[module].module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Import schemas
import { [Schema], [Schema]Schema } from './schemas/[schema].schema';

// Import repository
import { [Module]Repository } from './[module].repository';

// Import services
import { [Module]Service } from './[module].service';

// Import controller
import { [Module]Controller } from './[module].controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: [Schema].name, schema: [Schema]Schema }
    ])
  ],
  controllers: [[Module]Controller],
  providers: [
    [Module]Repository,  // Repository MUST be registered
    [Module]Service
  ],
  exports: [
    [Module]Repository,  // Export repository for cross-module use
    [Module]Service
  ]
})
export class [Module]Module {}
```

### PHASE 5: TESTING INFRASTRUCTURE (2 hours)

Create test utilities and update all service tests:

```typescript
// test/mocks/repository.mock.ts

export class MockRepository<T> {
  create = jest.fn();
  createMany = jest.fn();
  findById = jest.fn();
  findOne = jest.fn();
  find = jest.fn();
  findWithPagination = jest.fn();
  updateById = jest.fn();
  updateOne = jest.fn();
  updateMany = jest.fn();
  deleteById = jest.fn();
  deleteOne = jest.fn();
  deleteMany = jest.fn();
  aggregate = jest.fn();
  count = jest.fn();
  exists = jest.fn();
  withTransaction = jest.fn();
  bulkWrite = jest.fn();
}

// src/[module]/[module].service.spec.ts

describe('[Module]Service', () => {
  let service: [Module]Service;
  let repository: MockRepository<[Schema]Document>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        [Module]Service,
        {
          provide: [Module]Repository,
          useClass: MockRepository
        }
      ]
    }).compile();

    service = module.get<[Module]Service>([Module]Service);
    repository = module.get<[Module]Repository>([Module]Repository);
  });

  it('should create entity through repository', async () => {
    const mockData = { /* test data */ };
    repository.create.mockResolvedValue(mockData);

    const result = await service.create(mockData);

    expect(repository.create).toHaveBeenCalledWith(mockData);
    expect(result).toEqual(mockData);
  });
});
```

## VALIDATION CHECKLIST

### ✅ PHASE 6: VERIFICATION (1 hour)

Execute these validation steps IN ORDER:

```bash
# 1. No direct Model usage in services
grep -r "@InjectModel" --include="*.service.ts" . | wc -l
# Expected: 0

# 2. All repositories created
find . -name "*.schema.ts" | wc -l
find . -name "*.repository.ts" | wc -l
# Repository count should match schema count

# 3. Services only import repositories
grep -r "Repository" --include="*.service.ts" . | grep -v "import"
# Should show constructor injections only

# 4. No Mongoose imports in services
grep -r "mongoose" --include="*.service.ts" . | grep "import"
# Expected: 0 results

# 5. Module configuration check
grep -r "Repository" --include="*.module.ts" . | grep "providers"
# All repositories should be in providers array

# 6. Test coverage
npm run test:cov
# Repository layer should have 80%+ coverage
```

### ✅ CRITICAL SUCCESS CRITERIA

1. **ZERO direct schema/model usage in services** - All database operations MUST go through repositories
2. **One repository per schema** - Every schema has exactly one corresponding repository
3. **Complete operation coverage** - Repositories implement ALL database operations services need
4. **Proper dependency injection** - Repositories are properly registered in module providers
5. **Test isolation** - Services can be tested without database using mock repositories
6. **No business logic in repositories** - Repositories contain ONLY data access logic
7. **Consistent naming** - `[Module]Repository` pattern used throughout
8. **Transaction support** - Complex operations use repository transaction methods
9. **Error handling** - Repositories handle database errors appropriately
10. **Type safety** - Full TypeScript typing with no `any` types

## COMMON PITFALLS TO AVOID

### ❌ ANTI-PATTERNS TO ELIMINATE

1. **Mixed Concerns:**
```typescript
// WRONG - Business logic in repository
async createUserWithValidation(data) {
  if (!this.isValidEmail(data.email)) { // Business logic!
    throw new Error('Invalid email');
  }
  return this.create(data);
}

// RIGHT - Pure data access
async create(data) {
  return await this.model.create(data);
}
```

2. **Service-to-Model Direct Access:**
```typescript
// WRONG - Service accessing model
const user = await this.userModel.findOne();

// RIGHT - Service using repository
const user = await this.userRepository.findOne();
```

3. **Repository Returning Plain Objects:**
```typescript
// WRONG - Losing document methods
async findById(id): Promise<any> {
  return await this.model.findById(id).lean();
}

// RIGHT - Returning full documents
async findById(id): Promise<UserDocument> {
  return await this.model.findById(id).exec();
}
```

4. **Missing Transaction Support:**
```typescript
// WRONG - No transaction capability
async transferFunds(from, to, amount) {
  await this.debit(from, amount);
  await this.credit(to, amount); // What if this fails?
}

// RIGHT - Transactional operation
async transferFunds(from, to, amount) {
  return this.withTransaction(async (session) => {
    await this.debit(from, amount, { session });
    await this.credit(to, amount, { session });
  });
}
```

## EXECUTION TIMELINE

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Audit | 30 min | Complete dependency matrix |
| Repository Creation | 2 hours | All repository files created |
| Service Refactoring | 3 hours | All services use repositories |
| Module Configuration | 1 hour | All modules properly wired |
| Testing | 2 hours | Tests updated with mocks |
| Validation | 1 hour | All checks passing |

**Total Time: ~9.5 hours**

## FINAL QUALITY GATES

Before marking complete, ensure:

```typescript
// Run this verification script
const verifyRepositoryPattern = async () => {
  const checks = {
    noDirectModelUsage: await checkNoModelsInServices(),
    allRepositoriesCreated: await checkAllSchemasHaveRepositories(),
    properInjection: await checkRepositoryInjection(),
    testsUpdated: await checkTestsUseMocks(),
    noBusinessLogicInRepos: await checkRepositoryPurity()
  };

  const allPassed = Object.values(checks).every(check => check === true);

  if (!allPassed) {
    throw new Error('Repository pattern implementation incomplete');
  }

  console.log('✅ Repository pattern successfully implemented!');
};
```

## EXAMPLE TRANSFORMATION

### Complete Module Transformation Example - Users Module:

**Step 1: Create Repository**
```typescript
// src/users/users.repository.ts
@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return await this.userModel.findOne({
      email: email.toLowerCase()
    }).exec();
  }

  async findActive(limit?: number): Promise<UserDocument[]> {
    return await this.find(
      { status: 'active' },
      { limit, sort: { createdAt: -1 } }
    );
  }

  // ... all other methods
}
```

**Step 2: Refactor Service**
```typescript
// src/users/users.service.ts
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly profileRepository: ProfileRepository
  ) {}

  async findByEmail(email: string): Promise<UserDocument> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // ... all other methods using repository
}
```

**Step 3: Update Module**
```typescript
// src/users/users.module.ts
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema }
    ])
  ],
  providers: [
    UsersRepository,
    ProfileRepository,
    UsersService
  ],
  exports: [UsersRepository, UsersService]
})
export class UsersModule {}
```

## SUCCESS METRICS

You have successfully implemented the repository pattern when:

1. **Grep Tests Pass:**
   - `grep -r "@InjectModel" --include="*.service.ts"` returns 0 results
   - `grep -r "Model<" --include="*.service.ts"` returns 0 results
   - Every `.schema.ts` has a corresponding `.repository.ts`

2. **Dependency Graph:**
   - Controllers → Services → Repositories → Schemas
   - No shortcuts or bypasses in the chain

3. **Test Suite:**
   - All tests pass
   - Services tests use mock repositories
   - No database connections in unit tests

4. **Code Review Checklist:**
   - [ ] No `mongoose` imports in services
   - [ ] All CRUD operations go through repositories
   - [ ] Repositories handle all database concerns
   - [ ] Services contain only business logic
   - [ ] Proper error handling at each layer

---

**IMPORTANT**: This is a BREAKING CHANGE. Coordinate with your team and ensure all branches are merged before starting. Create a feature branch for this work and test thoroughly before merging.

**REMEMBER**: The goal is COMPLETE SEPARATION. If you find yourself questioning whether something belongs in service or repository, ask: "Is this business logic or data access?" Business logic → Service. Data access → Repository.

Execute this plan systematically and you will achieve 95%+ architectural compliance.