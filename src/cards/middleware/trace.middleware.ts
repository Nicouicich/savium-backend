import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestContextService } from '../../common/services/request-context.service';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TraceMiddleware.name);

  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const context = {
      traceId: req.headers['x-trace-id'] as string,
      userId: (req as any).user?.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      path: req.path,
      method: req.method
    };

    this.requestContext.run(context, () => {
      const traceId = this.requestContext.getTraceId();

      // Add trace ID to response headers
      res.setHeader('x-trace-id', traceId);

      // Log the request
      this.logger.debug('Card operation request', {
        traceId,
        method: req.method,
        path: req.path,
        userId: context.userId,
        userAgent: context.userAgent
      });

      next();
    });
  }
}
