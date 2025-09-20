import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

export interface RequestContext {
  traceId: string;
  userId?: string;
  accountId?: string;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
  path?: string;
  method?: string;
}

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  /**
   * Run a function within a request context
   */
  run<T>(context: Partial<RequestContext>, callback: () => T): T {
    const fullContext: RequestContext = {
      traceId: context.traceId || uuidv4(),
      userId: context.userId,
      accountId: context.accountId,
      userAgent: context.userAgent,
      ip: context.ip,
      timestamp: new Date(),
      path: context.path,
      method: context.method
    };

    return this.asyncLocalStorage.run(fullContext, callback);
  }

  /**
   * Get the current request context
   */
  getContext(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get the current trace ID
   */
  getTraceId(): string {
    const context = this.getContext();
    return context?.traceId || 'no-trace';
  }

  /**
   * Get the current user ID
   */
  getUserId(): string | undefined {
    const context = this.getContext();
    return context?.userId;
  }

  /**
   * Get the current account ID
   */
  getAccountId(): string | undefined {
    const context = this.getContext();
    return context?.accountId;
  }

  /**
   * Update the current context with additional data
   */
  updateContext(updates: Partial<RequestContext>): void {
    const currentContext = this.getContext();
    if (currentContext) {
      Object.assign(currentContext, updates);
    }
  }

  /**
   * Generate a new trace ID
   */
  generateTraceId(): string {
    return uuidv4();
  }

  /**
   * Check if we're currently in a request context
   */
  hasContext(): boolean {
    return this.getContext() !== undefined;
  }

  /**
   * Get context for logging purposes
   */
  getLoggingContext(): Partial<RequestContext> {
    const context = this.getContext();
    if (!context) {
      return {};
    }

    return {
      traceId: context.traceId,
      userId: context.userId,
      accountId: context.accountId,
      path: context.path,
      method: context.method
    };
  }
}
