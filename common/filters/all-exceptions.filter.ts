import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      message = typeof errorResponse === 'string' 
        ? errorResponse 
        : (errorResponse as any).message || exception.message;
      
      // Extract validation details if available
      if (typeof errorResponse === 'object' && (errorResponse as any).errors) {
        details = (errorResponse as any).errors;
      }
    } else if (exception instanceof MongooseError.CastError) {
      // Handle MongoDB ObjectId casting errors
      status = HttpStatus.BAD_REQUEST;
      const path = (exception as any).path;
      const value = (exception as any).value;
      
      if (path === '_id' || path.endsWith('Id')) {
        message = `Invalid ${path === '_id' ? 'ID' : path} format. Expected a valid MongoDB ObjectId (24-character hexadecimal string), but received: "${value}". Example format: "507f1f77bcf86cd799439011"`;
      } else {
        message = `Invalid ${path} format: "${value}". Expected a valid MongoDB ObjectId.`;
      }
      
      details = {
        field: path,
        value: value,
        expectedFormat: '24-character hexadecimal string',
        example: '507f1f77bcf86cd799439011'
      };
    } else if ((exception as any)?.name === 'ValidationError') {
      // Handle general validation errors
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      details = (exception as any).message;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    const errorDetails: any = {
      success: false,
      error: {
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
    };

    // Add details if available (validation errors, etc.)
    if (details) {
      errorDetails.error.details = details;
    }

    // Simplified logging based on error type and environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (status === HttpStatus.UNAUTHORIZED) {
      // Don't log unauthorized errors - these are expected when tokens are invalid/expired
      // Only log in development for debugging purposes
      if (isDevelopment) {
        this.logger.debug(`Unauthorized ${request.method} ${request.url}`);
      }
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