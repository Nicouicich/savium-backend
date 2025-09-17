import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Request } from 'express';
import { BaseException } from '../exceptions/base.exception';
import { RequestContextService } from './request-context';

@Injectable()
export class ErrorHandlingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ErrorHandler');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const traceId = request.traceId;

    return next.handle().pipe(
      catchError((error) => {
        const contextData = RequestContextService.getContext();
        
        // Simplified error logging - only log if it's a server error or in development
        const isDevelopment = process.env.NODE_ENV === 'development';
        const isServerError = error.status >= 500 || !error.status;
        
        if (isServerError || isDevelopment) {
          this.logger.error(`[${traceId}] ${error.message}`, {
            path: request.url,
            method: request.method,
            userId: contextData?.userId,
            ...(isDevelopment && error.stack && { stack: error.stack }),
          });
        }

        // Handle our custom business exceptions
        if (error instanceof BaseException) {
          return throwError(() => error);
        }

        // Handle NestJS HTTP exceptions
        if (error instanceof HttpException) {
          return throwError(() => error);
        }

        // Handle MongoDB errors
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
          return throwError(() => this.handleMongoError(error));
        }

        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
          return throwError(() => this.handleMongooseValidationError(error));
        }

        // Handle JWT errors
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
          return throwError(() => new HttpException(
            {
              code: 'TOKEN_ERROR',
              message: 'Authentication token is invalid or expired',
              timestamp: new Date().toISOString(),
            },
            HttpStatus.UNAUTHORIZED,
          ));
        }

        // Handle JSON parsing errors (SyntaxError from malformed JSON)
        if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
          return throwError(() => new HttpException(
            {
              code: 'INVALID_JSON',
              message: 'Invalid JSON format in request body',
              details: 'Please ensure your request body contains valid JSON',
              timestamp: new Date().toISOString(),
            },
            HttpStatus.BAD_REQUEST,
          ));
        }

        // Handle Multer file upload errors
        if (error.code === 'LIMIT_FILE_SIZE') {
          return throwError(() => new HttpException(
            {
              code: 'FILE_TOO_LARGE',
              message: 'File size exceeds the maximum allowed limit',
              timestamp: new Date().toISOString(),
            },
            HttpStatus.PAYLOAD_TOO_LARGE,
          ));
        }

        // Log unhandled errors - simplified
        this.logger.error(`[${traceId}] Unhandled: ${error.message}`);
        return throwError(() => new HttpException(
          {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred',
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === 'development' && { details: error.message }),
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        ));
      }),
    );
  }

  private handleMongoError(error: any): HttpException {
    switch (error.code) {
      case 11000:
        // Duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        return new HttpException(
          `${field} already exists`,
          HttpStatus.CONFLICT,
        );
      case 11001:
        return new HttpException(
          'Duplicate key error',
          HttpStatus.CONFLICT,
        );
      default:
        return new HttpException(
          'Database error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
  }

  private handleMongooseValidationError(error: any): HttpException {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    return new HttpException(
      {
        code: 'VALIDATION_ERROR',
        message: 'Data validation failed',
        errors: messages,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}