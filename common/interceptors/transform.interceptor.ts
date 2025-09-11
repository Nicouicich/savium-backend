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
          return {
            success: true,
            data: data.data || data,
            message: data.message,
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