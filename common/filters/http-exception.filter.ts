import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const errorResponse = exception.getResponse();
    const errorMessage = typeof errorResponse === 'string' 
      ? errorResponse 
      : (errorResponse as any).message || exception.message;

    const errorDetails = {
      success: false,
      error: {
        statusCode: status,
        message: errorMessage,
        details: typeof errorResponse === 'object' && errorResponse !== null 
          ? (errorResponse as any).errors || null
          : null,
        code: typeof errorResponse === 'object' && errorResponse !== null 
          ? (errorResponse as any).code || 'HTTP_EXCEPTION'
          : 'HTTP_EXCEPTION',
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
    };

    // Add trace ID to response if available
    if ((request as any).traceId) {
      response.setHeader('x-trace-id', (request as any).traceId);
    }

    // Log based on error type - expected errors get less verbose logging
    const isExpectedError = this.isExpectedError(status, request.url);
    
    if (isExpectedError) {
      // Don't log common expected errors (401, 403) as these are normal user behavior
      // Only log validation errors and 404s if in development mode
      if ((status === 400 || status === 404) && process.env.NODE_ENV === 'development') {
        this.logger.debug(`${status} ${errorMessage}`, {
          statusCode: status,
          path: request.url,
          method: request.method,
        });
      }
    } else {
      // Log unexpected errors with full details
      this.logger.error('HTTP Exception', {
        ...errorDetails.error,
        stack: exception.stack,
        user: (request as any).user?.id || 'anonymous',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
    }

    response.status(status).json(errorDetails);
  }

  private isExpectedError(status: number, path: string): boolean {
    // Expected authentication/authorization errors
    if (status === 401 || status === 403) {
      return true;
    }

    // Expected validation errors
    if (status === 400) {
      return true;
    }

    // Expected not found errors
    if (status === 404) {
      return true;
    }

    // Expected method not allowed
    if (status === 405) {
      return true;
    }

    // Expected rate limiting
    if (status === 429) {
      return true;
    }

    return false;
  }
}