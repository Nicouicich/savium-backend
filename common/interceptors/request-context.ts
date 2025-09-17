import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';

export interface RequestContext {
  traceId: string;
  userId?: string;
  userEmail?: string;
  startTime: number;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  ipAddress?: string;
}

@Injectable()
export class RequestContextService {
  public static als = new AsyncLocalStorage<RequestContext>();

  static getContext(): RequestContext | undefined {
    return this.als.getStore();
  }

  static setContext(context: RequestContext): void {
    this.als.enterWith(context);
  }

  static getTraceId(): string | undefined {
    return this.getContext()?.traceId;
  }

  static getUserId(): string | undefined {
    return this.getContext()?.userId;
  }

  static updateContext(updates: Partial<RequestContext>): void {
    const current = this.getContext();
    if (current) {
      this.setContext({ ...current, ...updates });
    }
  }
}