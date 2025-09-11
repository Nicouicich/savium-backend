# 🌟 Savium AI Backend

A comprehensive NestJS backend for a personal, family, couple, and business finance management application with AI integration.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Database Setup](#-database-setup)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

## 🚀 Features

### Core Features
- **Multi-Account Types**: Personal, Couple, Family, and Business accounts
- **JWT Authentication**: Access and refresh token system with Redis storage
- **Role-Based Access Control**: Comprehensive permission system
- **Expense Tracking**: Manual entry, AI processing, file upload support
- **AI Integration**: OpenAI GPT for expense categorization and analysis
- **Multi-Platform Integration**: WhatsApp and Telegram bot support
- **Comprehensive Reporting**: Monthly reports, category analysis, export functionality
- **Budget & Goal Management**: Financial planning and tracking
- **Real-time Notifications**: Email, push, and SMS notifications

### Technical Features
- **Production-Ready Architecture**: Clean code, SOLID principles
- **Comprehensive Security**: Helmet, CORS, rate limiting, input validation
- **Database Optimization**: MongoDB with proper indexing and aggregations
- **Caching Strategy**: Redis for sessions, rate limiting, and query caching
- **API Documentation**: Complete Swagger/OpenAPI documentation
- **Error Handling**: Centralized error management with proper logging
- **Testing Suite**: Unit and E2E tests with Jest
- **Development Tools**: ESLint, Prettier, hot reloading

## 🛠 Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: MongoDB with Mongoose ODM
- **Cache/Sessions**: Redis
- **Authentication**: JWT with Passport
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Validation**: Class-validator & Class-transformer
- **Security**: Helmet, CORS, Rate limiting
- **File Upload**: Multer
- **External APIs**: OpenAI, WhatsApp Business, Telegram Bot

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **pnpm** or **yarn**
- **MongoDB** (v6 or higher)
- **Redis** (v7 or higher)

### Optional (for integrations)
- OpenAI API key
- WhatsApp Business API credentials
- Telegram Bot token

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd savium
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your configurations (see [Configuration](#-configuration) section).

4. **Start required services**
   ```bash
   # Start MongoDB (if running locally)
   mongod

   # Start Redis (if running locally)
   redis-server
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

#### Required Variables
```env
# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/savium_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secrets (CHANGE IN PRODUCTION!)
JWT_ACCESS_SECRET=your-very-secure-access-token-secret-key-here
JWT_REFRESH_SECRET=your-very-secure-refresh-token-secret-key-here
```

#### Optional Variables (for full functionality)
```env
# External APIs
OPENAI_API_KEY=your-openai-api-key
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Email (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-email-password
```

See `.env.example` for all available configuration options.

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run start:dev
```
The application will start at `http://localhost:3000` with hot reloading enabled.

### Production Mode
```bash
npm run build
npm run start:prod
```

### Debug Mode
```bash
npm run start:debug
```

## 📚 API Documentation

### Swagger Documentation
Once the application is running, you can access the interactive API documentation at:
- **Swagger UI**: `http://localhost:3000/api/docs`

### Key Endpoints

#### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user profile

#### Users
- `GET /api/v1/users/me` - Get current user profile
- `PATCH /api/v1/users/me` - Update user profile
- `GET /api/v1/users` - List users (admin only)

#### Health Check
- `GET /health` - Application health status
- `GET /` - Welcome message

## 📁 Project Structure

```
src/
├── auth/                   # Authentication module
│   ├── dto/               # Data transfer objects
│   ├── strategies/        # Passport strategies
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── users/                 # Users module
│   ├── dto/
│   ├── schemas/
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.repository.ts
│   └── users.module.ts
├── common/                # Shared utilities
│   ├── constants/         # Enums and constants
│   ├── decorators/        # Custom decorators
│   ├── filters/           # Exception filters
│   ├── guards/            # Auth and role guards
│   ├── interceptors/      # Request/response interceptors
│   └── utils/             # Utility functions
├── config/                # Configuration files
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── jwt.config.ts
├── app.module.ts          # Root application module
├── app.controller.ts      # Root controller
├── app.service.ts         # Root service
└── main.ts               # Application entry point
```

## 🗄️ Database Setup

### MongoDB Setup

1. **Install MongoDB** (if not already installed)
   - [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/)

2. **Start MongoDB**
   ```bash
   mongod
   ```

3. **Create Database** (optional - will be created automatically)
   ```bash
   mongo
   use savium_dev
   ```

### Redis Setup

1. **Install Redis** (if not already installed)
   - [Redis Installation Guide](https://redis.io/download)

2. **Start Redis**
   ```bash
   redis-server
   ```

### Database Indexes

The application automatically creates necessary indexes for optimal performance:
- User email index (unique)
- User role and status indexes
- Timestamp indexes for queries

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

### Test Structure
```
test/
├── unit/                  # Unit tests
└── e2e/                   # End-to-end tests
```

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure production database URLs
4. Set up proper Redis configuration
5. Configure CORS for your frontend domains

### Production Build
```bash
npm run build
npm run start:prod
```

### Docker Support (Optional)
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://your-production-uri
REDIS_URL=redis://your-production-redis-url
JWT_ACCESS_SECRET=very-secure-production-secret
JWT_REFRESH_SECRET=very-secure-production-refresh-secret
```

## 📈 Performance Considerations

- **Database Indexes**: Properly indexed for common queries
- **Redis Caching**: Used for sessions, rate limiting, and frequently accessed data
- **Rate Limiting**: Configured to prevent abuse
- **Connection Pooling**: MongoDB connection pooling configured
- **Compression**: Response compression enabled
- **Security Headers**: Helmet.js for security headers

## 🔒 Security Features

- **JWT Authentication**: Access and refresh token system
- **Rate Limiting**: Prevents brute force and DoS attacks
- **Input Validation**: Comprehensive request validation
- **CORS Configuration**: Properly configured cross-origin requests
- **Helmet.js**: Security headers
- **Password Hashing**: bcrypt with configurable rounds
- **SQL Injection Protection**: MongoDB with Mongoose ODM

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary and confidential.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team

---

Built with ❤️ using NestJS, MongoDB, and Redis.