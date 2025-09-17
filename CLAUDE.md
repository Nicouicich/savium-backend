# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Savium is a comprehensive NestJS backend for a personal, family, couple, and business finance management application with AI integration. It features multi-account types with role-based access control, expense tracking with AI categorization, budget management, and integration with external services like WhatsApp and Telegram.

### Key Improvements Implemented
- **Request Tracing**: Each request has a unique trace ID for debugging and logging
- **Enhanced Error Handling**: Custom business exceptions with proper error codes
- **Clean Architecture**: Controllers contain no business logic, all moved to services
- **Email Service**: Complete mail service with templates for user flows
- **Comprehensive Logging**: Structured logging with trace IDs and user context

## Development Commands

### Start Development
```bash
npm run start:dev        # Start with hot reloading
npm run start:debug      # Start in debug mode
```

### Build and Production
```bash
npm run build           # Build the application
npm run start:prod      # Start production build
```

### Testing
```bash
npm run test           # Run unit tests
npm run test:watch     # Run tests in watch mode
npm run test:cov       # Run tests with coverage
npm run test:e2e       # Run end-to-end tests (includes comprehensive user flow tests)
```

### Code Quality
```bash
npm run lint           # Run ESLint with auto-fix (backend-oriented rules)
npm run format         # Format code with Prettier
```

### Important: Always run linting and type checking after making changes
- The project uses strict backend-oriented ESLint rules
- Custom path mapping: `@common/*` points to `common/` directory (outside src)

## Critical Coding Standards

### TypeScript Strict Rules
- **NEVER use `as any` type assertions** - This is strictly prohibited in the codebase
- Use proper TypeScript typing and interfaces instead of type assertions
- If you encounter type issues, create proper interfaces or use generic types
- When working with external libraries, create proper type definitions rather than using `any`

## Architecture Overview

### Module Structure
The application follows NestJS modular architecture with domain-driven design:

- **Core Business Modules**: `auth/`, `users/`, `accounts/`, `expenses/`, `budgets/`, `goals/`, `reports/`, `categories/`
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
- Repository pattern for data access
- Proper indexing and aggregation pipelines
- Schema validation with class-transformer/class-validator

**Multi-Account System**:
- Four account types: Personal, Couple, Family, Business
- Account-specific role permissions (see `common/constants/user-roles.ts`)
- Configurable privacy settings per account type
- Member management with invitation system

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
- Welcome emails, password resets, invitations, expense digests
- Template-based HTML emails with proper styling

## Key Constants and Enums

**User Roles** (`src/common/constants/user-roles.ts`):
- Global roles: `SUPER_ADMIN`, `ADMIN`, `USER`
- Account-specific roles: `OWNER`, `PARTNER`, `PARENT`, `CHILD`, `BUSINESS_OWNER`, `MANAGER`, etc.
- Permission system with detailed role-permission mappings

**Account Types** (`src/common/constants/account-types.ts`):
- Account types with member limits and feature configurations
- Privacy settings per account type
- Status management (active, inactive, suspended, pending)

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