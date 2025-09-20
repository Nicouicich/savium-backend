import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CardEntity } from '../entities/card.entity';

/**
 * Decorator to extract the current card from the request
 * This card is set by the CardOwnershipGuard after validation
 */
export const CurrentCard = createParamDecorator((data: unknown, ctx: ExecutionContext): CardEntity => {
  const request = ctx.switchToHttp().getRequest();
  return request.card;
});
