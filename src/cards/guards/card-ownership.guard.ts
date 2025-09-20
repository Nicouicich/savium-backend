import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { CardsRepository } from '../cards.repository';
import { RequestContextService } from '../../common/services/request-context.service';
import { CardOwnershipException } from '@common/exceptions/card.exceptions';

@Injectable()
export class CardOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(CardOwnershipGuard.name);

  constructor(
    private readonly cardsRepository: CardsRepository,
    private readonly requestContext: RequestContextService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const cardId = request.params.id || request.params.cardId;
    const profileId = request.body?.profileId || request.query?.profileId;
    const traceId = this.requestContext.getTraceId();

    if (!user || !user.id) {
      this.logger.warn('No user found in request', { traceId });
      return false;
    }

    if (!cardId) {
      this.logger.warn('No card ID found in request', { traceId, userId: user.id });
      return false;
    }

    try {
      const card = await this.cardsRepository.findById(cardId);

      if (!card) {
        this.logger.warn('Card not found', { cardId, userId: user.id, traceId });
        return false;
      }

      // Check if user owns the card
      if (card.userId !== user.id) {
        this.logger.warn('Card ownership validation failed', {
          cardId,
          cardUserId: card.userId,
          requestUserId: user.id,
          traceId
        });
        throw new CardOwnershipException(cardId, user.id, profileId, traceId);
      }

      // Check profile ownership if profile ID is provided
      if (profileId && card.profileId.toString() !== profileId) {
        this.logger.warn('Card profile validation failed', {
          cardId,
          cardProfileId: card.profileId.toString(),
          requestProfileId: profileId,
          userId: user.id,
          traceId
        });
        throw new CardOwnershipException(cardId, user.id, profileId, traceId);
      }

      // Add card to request for use in controllers
      request.card = card;

      this.logger.debug('Card ownership validated successfully', {
        cardId,
        userId: user.id,
        traceId
      });

      return true;
    } catch (error) {
      this.logger.error('Card ownership validation error', {
        error: error.message,
        cardId,
        userId: user.id,
        traceId
      });

      if (error instanceof CardOwnershipException) {
        throw error;
      }

      return false;
    }
  }
}
