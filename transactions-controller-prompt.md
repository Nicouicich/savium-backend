# 🎯 **PRECISION-ENGINEERED PROMPT: NestJS Transactions Controller Implementation**

---

## **ROLE & CONTEXT**
You are a **Senior Backend Engineer** specializing in NestJS with 10+ years of experience in financial systems and clean architecture patterns. You're working on the **Savium** backend - a comprehensive finance management application with strict architectural principles.

**CRITICAL CONTEXT:**
- **Framework**: NestJS with MongoDB/Mongoose ODM
- **Architecture**: Clean Controller → Service → Repository pattern (MANDATORY)
- **Package Manager**: PNPM only (NOT npm)
- **TypeScript**: Strict mode - **ABSOLUTELY NO `as any` TYPE ASSERTIONS**
- **Path Mapping**: `@common/*` → `common/` directory
- **Testing**: MANDATORY for all functionality (no exceptions)

---

## **TASK SPECIFICATION**

Implement CRUD operations for the transactions controller with the following **EXACT** requirements:

### **1. COMPLETE CRUD IMPLEMENTATION REQUIRED**
Implement ALL layers: Controller → Service → Repository for the following operations:

**ENDPOINTS** (transactions.controller.ts):
```typescript
// Required endpoints (CREATE already exists - skip it):
GET    /transactions          - Find all with filtering
GET    /transactions/:id      - Find single transaction
PATCH  /transactions/:id      - Update transaction
DELETE /transactions/:id      - Delete transaction (HARD DELETE)
```

### **2. FILTERING REQUIREMENTS FOR FINDALL**
**MANDATORY FILTERS:**
- `profileId`: ALWAYS filter by user's activeProfileId from JWT (security requirement)
- `startDate` & `endDate`: Date range filtering
- `minAmount` & `maxAmount`: Amount range filtering
- `id`: Single transaction by ID (when provided)

**ADDITIONAL FILTERS FROM DTO:**
- All filters from existing `TransactionQueryDto`
- Pagination: `page`, `limit`, `sortBy`, `sortOrder`

---

## **ARCHITECTURAL CONSTRAINTS (VIOLATIONS = FAILURE)**

### **🔴 ABSOLUTE PROHIBITIONS:**
1. **NO QUERIES IN SERVICES** - ALL database operations MUST be in repositories
2. **NO BUSINESS LOGIC IN CONTROLLERS** - Controllers only handle HTTP layer
3. **NO CROSS-DOMAIN REPOSITORY ACCESS** - Transactions module can ONLY use TransactionsRepository
4. **NO TYPE ASSERTIONS** - Never use `as any` or unsafe type casts
5. **NO MODIFICATIONS OUTSIDE MODULE** - Stay within `src/transactions/` directory

### **✅ MANDATORY PATTERNS:**

**CONTROLLER LAYER:**
```typescript
// Controllers MUST:
- Use decorators: @Get(), @Patch(), @Delete()
- Apply guards: @UseGuards(JwtAuthGuard)
- Use @CurrentUser() decorator for user context
- Return DTOs: TransactionResponseDto
- Handle only HTTP concerns
```

**SERVICE LAYER:**
```typescript
// Services MUST:
- Contain ALL business logic
- Orchestrate repository calls
- Handle validation/authorization
- Transform entities to DTOs
- Use existing exceptions from @common/exceptions
```

**REPOSITORY LAYER:**
```typescript
// Repository MUST:
- Contain ALL database queries
- Use Mongoose aggregation pipelines for complex queries
- Return TransactionDocument types
- Implement proper indexing hints
- Handle pagination via PaginatedResult<T> interface
```

---

## **IMPLEMENTATION REQUIREMENTS**

### **Step 1: Repository Methods** (transactions.repository.ts)
Add these methods to existing repository:

```typescript
// Required signatures:
async findAll(query: TransactionQueryDto, profileId: string): Promise<PaginatedResult<TransactionDocument>>
async findById(id: string, profileId: string): Promise<TransactionDocument | null>
async update(id: string, updateDto: UpdateTransactionDto, profileId: string): Promise<TransactionDocument | null>
async delete(id: string, profileId: string): Promise<boolean>
```

**QUERY BUILDING RULES:**
- Build MongoDB filter object dynamically based on provided filters
- Use proper type checking for ObjectId conversions
- Implement efficient pagination with `skip` and `limit`
- Use compound indexes: `{ profileId: 1, date: -1 }`
- NO soft delete logic - direct MongoDB document removal

### **Step 2: Service Methods** (transactions.service.ts)
Add business logic methods:

```typescript
// Required signatures:
async findAll(query: TransactionQueryDto, user: UserForJWT): Promise<PaginatedResult<TransactionResponseDto>>
async findById(id: string, user: UserForJWT): Promise<TransactionResponseDto>
async update(id: string, updateDto: UpdateTransactionDto, user: UserForJWT): Promise<TransactionResponseDto>
async delete(id: string, user: UserForJWT): Promise<void>
```

**BUSINESS LOGIC REQUIREMENTS:**
- Extract `activeProfileId` from user context (user.activeProfileId from JWT)
- Validate that activeProfileId exists (throw exception if user has no active profile)
- ALL transactions MUST be filtered by this activeProfileId for security
- Transform documents to response DTOs
- Handle not found cases with `TransactionNotFoundException`
- Clear cache after modifications (use existing EnhancedCacheService)
- For delete: Permanently remove from database (NO soft delete)

### **Step 3: Controller Endpoints** (transactions.controller.ts)
Implement HTTP handlers:

```typescript
@Get()
@ApiOperation({ summary: 'Get all transactions with filters' })
async findAll(@Query() query: TransactionQueryDto, @CurrentUser() user: UserForJWT)

@Get(':id')
@ApiOperation({ summary: 'Get transaction by ID' })
async findOne(@Param('id') id: string, @CurrentUser() user: UserForJWT)

@Patch(':id')
@ApiOperation({ summary: 'Update transaction' })
async update(@Param('id') id: string, @Body() updateDto: UpdateTransactionDto, @CurrentUser() user: UserForJWT)

@Delete(':id')
@ApiOperation({ summary: 'Delete transaction permanently' })
@HttpCode(204)
async delete(@Param('id') id: string, @CurrentUser() user: UserForJWT)
```

---

## **CODE QUALITY REQUIREMENTS**

### **TypeScript Standards:**
```typescript
// CORRECT: Proper typing with activeProfileId validation
if (!user.activeProfileId) {
  throw new UnauthorizedAccessException('User has no active profile');
}
const profileId: Types.ObjectId = new Types.ObjectId(user.activeProfileId);
const filter: FilterQuery<TransactionDocument> = { profileId };

// WRONG: Type assertions
const profileId = user.activeProfileId as any; // PROHIBITED!
```

### **Error Handling:**
```typescript
// Use existing exceptions:
import { TransactionNotFoundException, UnauthorizedAccessException } from '@common/exceptions';

// Pattern:
if (!transaction) {
  throw new TransactionNotFoundException(id);
}
```

### **Pagination Pattern:**
```typescript
const { page = 1, limit = 20 } = query;
const skip = (page - 1) * limit;
const total = await this.transactionModel.countDocuments(filter);
const data = await this.transactionModel
  .find(filter)
  .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
  .skip(skip)
  .limit(limit)
  .exec();

// For DELETE operation:
const result = await this.transactionModel.findOneAndDelete({ _id: id, profileId });
return !!result;
```

---

## **TESTING REQUIREMENTS (MANDATORY)**

Create test files:
- `transactions.controller.spec.ts` - Controller unit tests
- `transactions.service.spec.ts` - Service unit tests
- `transactions.repository.spec.ts` - Repository integration tests

**Test Coverage Requirements:**
- All happy paths
- Error scenarios (not found, unauthorized)
- Filter combinations
- Pagination edge cases
- Hard delete functionality

---

## **DELIVERABLES CHECKLIST**

- [ ] **Repository Layer**: All 4 methods with proper MongoDB queries
- [ ] **Service Layer**: Business logic with proper authorization
- [ ] **Controller Layer**: Clean HTTP handlers with decorators
- [ ] **DTO Validation**: Use existing DTOs, no modifications
- [ ] **Error Handling**: Proper exceptions from @common/exceptions
- [ ] **Testing**: Complete test coverage for all layers
- [ ] **No Schema Changes**: Work with existing TransactionDocument
- [ ] **Clean Code**: Follows existing patterns from users module

---

## **SUCCESS CRITERIA**

✅ **Code compiles** without TypeScript errors
✅ **All tests pass** with >90% coverage
✅ **Filters work correctly** including profile isolation
✅ **Proper authorization** - users can only access their profile's transactions
✅ **Hard delete** removes data permanently
✅ **Performance optimized** using existing indexes
✅ **Clean separation** between layers maintained

---

## **REFERENCE IMPLEMENTATION PATTERN**

Study the `UsersController` pattern at `src/users/users.controller.ts` for decorator usage and response formatting. Follow the exact same patterns for consistency.

**IMPORTANT**: The user's `activeProfileId` is now included in the JWT token as `user.activeProfileId` (string). This field has been added to UserForJWT interface and UserMapper to ensure all transactions are properly filtered by the user's active profile for security.

---

**START IMPLEMENTATION NOW** focusing on one layer at a time: Repository → Service → Controller → Tests

Remember: **NO QUERIES IN SERVICES**, **NO BUSINESS LOGIC IN CONTROLLERS**, **NO TYPE ASSERTIONS**