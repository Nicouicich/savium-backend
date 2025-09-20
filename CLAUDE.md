# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Savium is a comprehensive NestJS backend for a personal, family, couple, and business finance management application with AI integration. It features multi-account types with role-based access control, transaction tracking with AI categorization, budget management, and integration with external services like WhatsApp and Telegram.

### Key Improvements Implemented

- **Request Tracing**: Each request has a unique trace ID for debugging and logging
- **Enhanced Error Handling**: Custom business exceptions with proper error codes
- **Clean Architecture**: Controllers contain no business logic, all moved to services
- **Email Service**: Complete mail service with templates for user flows
- **Comprehensive Logging**: Structured logging with trace IDs and user context

## Development Commands

**IMPORTANT**: This project uses PNPM as the package manager. Always use `pnpm` commands instead of `npm`.

### Start Development

```bash
pnpm start:dev          # Start with hot reloading
pnpm start:debug        # Start in debug mode
pnpm start:dev:clean    # Kill port 8080 and start dev (Windows-specific)
```

### Build and Production

```bash
pnpm build              # Build the application
pnpm start              # Start production build
pnpm start:prod         # Start production build (alternative)
```

### Testing

```bash
pnpm test               # Run unit tests
pnpm test:watch         # Run tests in watch mode
pnpm test:cov           # Run tests with coverage
pnpm test:e2e           # Run end-to-end tests (includes comprehensive user flow tests)
pnpm test:debug         # Run tests in debug mode
```

### Code Quality

```bash
pnpm lint               # Run ESLint with auto-fix (backend-oriented rules)
pnpm format             # Format code with dprint (replaces Prettier)
pnpm kill-port          # Kill process on port 8080 (Windows-specific)
```

### Important: Always run linting after making changes

- The project uses strict backend-oriented ESLint rules
- Uses dprint for code formatting instead of Prettier
- Custom path mapping: `@common/*` points to `common/` directory (outside src)

## Critical Coding Standards

### TypeScript Strict Rules

- **PROHIBIDO usar `as any` type assertions** - This is strictly prohibited in the codebase
- Use proper TypeScript typing and interfaces instead of type assertions
- If you encounter type issues, create proper interfaces or use generic types
- When working with external libraries, create proper type definitions rather than using `any`

### Architecture Layer Separation (MANDATORY)

**PROHIBIDO**: Implementar cualquier funcionalidad sin testearla. Always implement tests for any functionality.

**Controller → Service → Repository Pattern**:
- **Controllers**: Only handle HTTP requests/responses, no business logic
- **Services**: Contain all business logic, orchestrate repository calls
- **Repositories**: Handle all database queries and operations, separated by domain

**🚨 EXTREMADAMENTE PROHIBIDO: CROSS-DOMAIN REPOSITORY ACCESS 🚨**:
- **NEVER** access repositories from other domains directly
- Example: WhatsApp Service CANNOT access User Repository directly
- Example: Transaction Service CANNOT access Category Repository directly
- **ALWAYS** go through the owning service: WhatsApp Service → User Service → User Repository
- This enforces proper domain boundaries and SOLID principles

**Repository Ownership Rule**:
- Only the schema owner can interact with its repository
- Each domain owns its own data access layer
- Cross-domain data access MUST go through services, never repositories
- **NO QUERIES WITHIN SERVICES** - All database operations must go through repositories

**SOLID Principles Enforcement (100%)**:
- **Single Responsibility**: Each service/repository has one clear purpose
- **Open/Closed**: Extend behavior through interfaces, not modification
- **Liskov Substitution**: Implementations must be substitutable
- **Interface Segregation**: No forced dependencies on unused interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions

**Query Separation**:
- Separate read and write operations in repositories when beneficial
- Keep complex queries isolated in repository methods
- Use meaningful method names that describe the query purpose

## Architecture Overview

### Module Structure

The application follows NestJS modular architecture with domain-driven design:

- **Core Business Modules**: `auth/`, `users/`, `financial-profiles/`, `transactions/`, `budgets/`, `goals/`, `reports/`, `categories/`
- **Integration Modules**: `integrations/ai/`, `integrations/whatsapp/`, `integrations/telegram/`
- **Support Modules**: `notifications/`, `common/`

### Key Architectural Components

**Configuration System** (`src/config/`):

- Environment-based configuration with validation
- Separate configs for database, Redis, JWT, integrations
- Global configuration module using `@nestjs/config`

**Authentication & Authorization**:

- JWT-based authentication with access/refresh tokens
- Redis-backed session storage
- Role-based access control (RBAC) with account-specific roles
- Passport strategies for local and JWT authentication

**Database Layer**:

- MongoDB with Mongoose ODM
- **Strict Repository Pattern**: Each module has its own repository for database access
- **Domain Repository Ownership**: Only schema owners can access their repositories
- **ZERO Cross-Domain Repository Access**: Domains communicate only through services
- Repository examples: `UsersRepository`, `TransactionsRepository`, `CategoriesRepository`
- Service-to-Service communication for cross-domain data access
- Proper indexing and aggregation pipelines
- Schema validation with class-transformer/class-validator

**Multi-Profile System**:

- Four profile types: Personal, Couple, Family, Business (NOT account types)
- All users have a Personal profile created automatically during account creation
- All transactions and categories are assigned to a specific profile
- Profile-specific privacy settings and permissions
- Each profile type has different member management capabilities
- Users can have multiple profiles and switch between them

**Request Tracing & Logging**:

- Every request gets a unique trace ID (UUID)
- Trace IDs are returned in response headers (`x-trace-id`)
- AsyncLocalStorage for request context throughout the app
- Structured logging with trace IDs and user context

**Error Handling**:

- Custom business exception classes in `common/exceptions/`
- Global error interceptor with proper error formatting
- Different error types: ValidationException, NotFoundResourceException, etc.
- Error codes and user-friendly messages

**Mail System**:

- Nodemailer-based email service with templates
- Welcome emails, password resets, invitations, transaction digests
- Template-based HTML emails with proper styling

## Key Constants and Enums

**User Roles** (`src/common/constants/user-roles.ts`):

- Global roles: `SUPER_ADMIN`, `ADMIN`, `USER`
- Account-specific roles: `OWNER`, `PARTNER`, `PARENT`, `CHILD`, `BUSINESS_OWNER`, `MANAGER`, etc.
- Permission system with detailed role-permission mappings

**Profile Types** (`src/financial-profiles/schemas/index.ts`):

- Four profile types: Personal, Couple, Family, Business
- Profile-specific schemas and repositories for each type
- Each profile has its own privacy settings, transactions, and categories
- Base profile schema with common fields shared across all types
- Profile status management (active, inactive, archived)

## Database Setup Requirements

Before running the application, ensure these services are running:

- **MongoDB** (v6+) on default port 27017
- **Redis** (v7+) on default port 6379

## Environment Configuration

Copy `.env.example` to `.env` and configure:

- Database URI for MongoDB
- Redis connection details
- JWT secrets (must be changed in production)
- External API keys (OpenAI, WhatsApp, Telegram) - optional for basic functionality

## API Structure

- **Global prefix**: `/api/v1`
- **Swagger documentation**: Available at `/api/docs` when running
- **Authentication**: Bearer token required for most endpoints
- **Rate limiting**: Configured with multiple time windows (short, medium, long)

## Security Features

- Helmet.js for security headers
- CORS configuration
- Request validation with whitelist/transform
- Rate limiting via Redis
- Input sanitization and validation
- Password hashing with bcrypt

## Development Notes

- Uses TypeScript with strict configuration
- ESLint and Prettier for code formatting
- Jest for testing with coverage reports
- Hot reloading enabled in development mode
- Comprehensive error handling with centralized filters
