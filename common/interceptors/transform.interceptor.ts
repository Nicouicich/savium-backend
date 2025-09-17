import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  timestamp: string;
  path: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url;

    // Skip transform for WhatsApp webhook verification endpoint
    if (path.includes('/webhook') && request.query['hub.challenge']) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Handle different response types
        if (data && typeof data === 'object' && 'data' in data && 'pagination' in data) {
          // Response already formatted with pagination
          return {
            success: true,
            data: data.data,
            pagination: data.pagination,
            timestamp: new Date().toISOString(),
            path,
          };
        }

        if (data && typeof data === 'object' && 'message' in data) {
          // Response with custom message
          const messageData = data as Record<string, unknown> & { message: unknown };
          const message = typeof messageData.message === 'string' ? messageData.message : undefined;
          return {
            success: true,
            data: 'data' in messageData ? messageData.data : data,
            message,
            timestamp: new Date().toISOString(),
            path,
          };
        }

        // Standard response
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          path,
        };
      }),
    );
  }
}