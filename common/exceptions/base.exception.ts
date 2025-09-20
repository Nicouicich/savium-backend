import { HttpException, HttpStatus } from '@nestjs/common';

export abstract class BaseException extends HttpException {
  abstract readonly code: string;
  abstract readonly userMessage: string;

  constructor(
    message: string,
    status: HttpStatus,
    public readonly context?: Record<string, any>
  ) {
    super(message, status);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.userMessage,
      timestamp: new Date().toISOString(),
      context: this.context
    };
  }
}
