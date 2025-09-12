import { HttpException, HttpStatus } from '@nestjs/common';

export class PaymentException extends HttpException {
  constructor(message: string, code?: string) {
    super({ message, code }, HttpStatus.BAD_REQUEST);
  }
}
