import {HttpException, HttpStatus} from '@nestjs/common';

export class NotFoundResourceException extends HttpException {
  constructor(message: string, code?: string) {
    super({message, code}, HttpStatus.NOT_FOUND);
  }
}
