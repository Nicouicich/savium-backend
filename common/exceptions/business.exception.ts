import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly errorCode?: string
  ) {
    super(
      {
        success: false,
        message,
        errorCode,
        timestamp: new Date().toISOString(),
      },
      statusCode
    );
  }
}