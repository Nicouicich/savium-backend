import { HttpException, HttpStatus, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import helmet from 'helmet';

import { ErrorHandlingInterceptor } from '@common/interceptors/error-handling.interceptor';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { AppModule } from './app.module';

async function bootstrap() {
  // Configure log levels based on environment
  const isDev = process.env.NODE_ENV === 'development';
  const logLevels: ('error' | 'warn' | 'log' | 'debug' | 'verbose' | 'fatal')[] = isDev ? ['error', 'warn', 'log', 'debug'] : ['error', 'warn', 'log'];

  const app = await NestFactory.create(AppModule, {
    logger: logLevels
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security Middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ['\'self\''],
          styleSrc: ['\'self\'', '\'unsafe-inline\''],
          scriptSrc: ['\'self\''],
          imgSrc: ['\'self\'', 'data:', 'https:']
        }
      }
    })
  );

  // CORS Configuration - Allow Postman and other development tools
  const isDevelopment = configService.get('app.nodeEnv') === 'development';
  app.enableCors({
    origin: isDevelopment ? true : configService.get('app.corsOrigin'), // Allow all origins in development
    credentials: configService.get('app.corsCredentials'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'X-Requested-With', 'Range', 'X-Trace-Id']
  });

  // Global Interceptors (order matters: Logging -> ErrorHandling)
  app.useGlobalInterceptors(new LoggingInterceptor(), new ErrorHandlingInterceptor());

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: false, // Always show validation errors for better debugging
      exceptionFactory: errors => {
        const formattedErrors = errors.map(error => ({
          field: error.property,
          message: Object.values(error.constraints || {}).join(', '),
          value: error.value
        }));

        // Log detailed validation errors for debugging
        console.error('Validation failed:', {
          errors: formattedErrors,
          timestamp: new Date().toISOString()
        });

        return new HttpException(
          {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            errors: formattedErrors,
            timestamp: new Date().toISOString()
          },
          HttpStatus.BAD_REQUEST
        );
      },
      validationError: {
        target: false,
        value: false
      }
    })
  );

  // Global Rate Limiting Guard - configured automatically by ThrottlerModule

  // API Prefix
  app.setGlobalPrefix('api/v1');

  // Swagger Documentation Setup
  const swaggerConfig = configService.get('swagger');
  const config = new DocumentBuilder()
    .setTitle(swaggerConfig.title)
    .setDescription(swaggerConfig.description)
    .setVersion(swaggerConfig.version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header'
      },
      'JWT-auth'
    )
    .addServer(configService.get('app.url') || 'http://localhost:3000', 'Development server')
    .build();

  // Add Swagger tags
  swaggerConfig.tags.forEach(tag => {
    config.tags = config.tags || [];
    config.tags.push(tag);
  });

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(swaggerConfig.path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha'
    },
    customSiteTitle: 'Savium AI API Documentation',
    customfavIcon: '/favicon.ico',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js'
    ],
    customCssUrl: ['https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css']
  });

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    logger.log(`📴 Received ${signal}. Starting graceful shutdown...`);
    try {
      await app.close();
      logger.log('✅ Application closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle unhandled rejections and exceptions
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', error => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  // Start server
  const port = configService.get('app.port');
  await app.listen(port);

  logger.log(`🚀 Application is running on: ${configService.get('app.url')}`);
  logger.log(`📚 Swagger documentation: ${configService.get('app.url')}/${swaggerConfig.path}`);
  logger.log(`🌍 Environment: ${configService.get('app.nodeEnv')}`);
  logger.log(`📂 Global API Prefix: /api/v1`);
}

bootstrap().catch(error => {
  console.error('❌ Error starting server:', error);
  process.exit(1);
});
