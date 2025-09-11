import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      message = typeof errorResponse === 'string' 
        ? errorResponse 
        : (errorResponse as any).message || exception.message;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    const errorDetails = {
      success: false,
      error: {
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
    };

    // Simplified logging based on error type and environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (status === HttpStatus.UNAUTHORIZED) {
      // Log unauthorized access as warn - minimal info
      this.logger.warn(`Unauthorized ${request.method} ${request.url} - ${request.ip}`);
    } else if (status >= 500) {
      // Log server errors with more detail
      this.logger.error(`${status} ${request.method} ${request.url}`, {
        message,
        user: (request as any).user?.id || 'anonymous',
        ...(isDevelopment && exception instanceof Error && { stack: exception.stack }),
      });
    } else if (isDevelopment) {
      // Log client errors (4xx) only in development
      this.logger.debug(`${status} ${request.method} ${request.url} - ${message}`);
    }

    response.status(status).json(errorDetails);
  }
}