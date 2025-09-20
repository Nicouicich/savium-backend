import { ValidationException } from '@common/exceptions/business.exceptions';
import { ArgumentMetadata, Injectable, Logger, PipeTransform } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import { RequestContextService } from '../../common/services/request-context.service';

@Injectable()
export class ValidateCardPipe implements PipeTransform {
  private readonly logger = new Logger(ValidateCardPipe.name);

  constructor(private readonly requestContext: RequestContextService) {}

  transform(value: any, metadata: ArgumentMetadata): any {
    const traceId = this.requestContext.getTraceId();

    // Only validate if this is a parameter (card ID)
    if (metadata.type === 'param' && metadata.data === 'id') {
      if (!value) {
        throw new ValidationException('Card ID is required', { traceId });
      }

      if (typeof value !== 'string') {
        throw new ValidationException('Card ID must be a string', { traceId });
      }

      if (!isMongoId(value)) {
        throw new ValidationException('Card ID must be a valid MongoDB ObjectId', { traceId });
      }

      this.logger.debug('Card ID validated successfully', { cardId: value, traceId });
    }

    return value;
  }
}
