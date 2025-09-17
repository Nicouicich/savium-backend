import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestContextService, RequestContext } from './request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();

    // Generate unique trace ID for this request
    const traceId = request.headers['x-trace-id'] as string || uuidv4();
    const userId = request.user?.id;

    // Set trace ID in response headers for client tracking
    response.setHeader('x-trace-id', traceId);

    // Store trace ID in request for use in controllers/services
    request.traceId = traceId;

    // Create request context
    const requestContext: RequestContext = {
      traceId,
      userId,
      userEmail: request.user?.email,
      startTime,
      method,
      url: url.split('?')[0], // Remove query params from logs for cleaner output
      ip,
      ipAddress: ip,
      userAgent: userAgent.substring(0, 100), // Truncate user agent
    };

    // Log incoming request - simplified
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      this.logger.log(`→ ${method} ${url}`);
    }

    // Set the request context for the entire request lifecycle using AsyncLocalStorage
    return RequestContextService.als.run(requestContext, () =>
      next.handle().pipe(
        tap({
          next: (data) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            const { statusCode } = response;
            const responseSize = response.get('content-length') || JSON.stringify(data)?.length || 0;

            // Log successful responses - simplified
            if (isDevelopment) {
              this.logger.log(`← ${statusCode} ${method} ${url} [${duration}ms]`);
            }
          },
          error: (error) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            const statusCode = error.status || error.statusCode || 500;

            // Log errors - simplified, avoid duplicate logging with error filter
            const isServerError = statusCode >= 500;
            if (isServerError) {
              this.logger.error(`✗ ${statusCode} ${method} ${url} [${duration}ms] - ${error.message}`);
            } else if (isDevelopment) {
              this.logger.warn(`✗ ${statusCode} ${method} ${url} [${duration}ms]`);
            }
          },
        }),
      )
    );
  }
}