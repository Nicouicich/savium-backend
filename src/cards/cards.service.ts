import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { CardsRepository } from './cards.repository';
import { EncryptionService, RequestContextService } from '@common/common.module';
import { CardEntity } from './entities/card.entity';
import { CardBalanceEntity } from './entities/card-balance.entity';
import { CreateCardDto, UpdateCardDto, CardQueryDto, CreateCardBalanceDto } from './dto';
import {
  CardNotFoundException,
  CardLimitExceededException,
  DuplicateCardNameException,
  InvalidCardOperationException,
  CardExpiredException,
  CardInactiveException,
  DefaultCardException,
  CardBalanceUpdateException,
  CardOwnershipException,
  CardDeletionException
} from '@common/exceptions/card.exceptions';
import { CardStatus, CardType, CARD_LIMITS_BY_ACCOUNT_TYPE } from '@common/constants/card-types';
import { IMaskedCard, ICardStatistics, IPaymentDueSummary, IDebtSummary } from './interfaces/card.interface';

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    private readonly cardsRepository: CardsRepository,
    private readonly encryptionService: EncryptionService,
    private readonly requestContext: RequestContextService
  ) {}

  /**
   * Create a new card
   */
  async createCard(userId: string, profileId: string, createCardDto: CreateCardDto): Promise<IMaskedCard> {
    const traceId = this.requestContext.getTraceId();

    try {
      // Validate card limit for profile type
      await this.validateCardLimit(userId, profileId);

      // Validate unique display name
      await this.validateUniqueDisplayName(createCardDto.displayName, userId, profileId);

      // Encrypt last four digits if provided
      const encryptedLastFour = createCardDto.lastFourDigits ? this.encryptionService.encryptLastFourDigits(createCardDto.lastFourDigits) : undefined;

      // Check if this should be the default card (first card)
      const existingCardsCount = await this.cardsRepository.countByUserAndProfile(userId, profileId);
      const isFirstCard = existingCardsCount === 0;

      // Create card
      const cardData = {
        ...createCardDto,
        userId,
        profileId: new Types.ObjectId(profileId),
        lastFourDigits: encryptedLastFour,
        isDefault: isFirstCard,
        status: CardStatus.ACTIVE
      };

      const card = await this.cardsRepository.create(cardData);

      // Create initial balance for credit cards
      if (createCardDto.cardType === CardType.CREDIT && createCardDto.creditLimit) {
        await this.createInitialBalance(card._id!.toString(), createCardDto.creditLimit);
      }

      this.logger.log(`Card created successfully: ${card.displayName}`, { userId, cardId: card._id, traceId });

      return this.maskCardDetails(card);
    } catch (error) {
      this.logger.error(`Failed to create card for user ${userId}`, { error: error.message, traceId });

      if (error instanceof CardLimitExceededException || error instanceof DuplicateCardNameException) {
        throw error;
      }

      throw new InvalidCardOperationException('create card', error.message, traceId);
    }
  }

  /**
   * Find all cards for user and profile
   */
  async findAllCards(
    userId: string,
    profileId: string,
    query: CardQueryDto = {}
  ): Promise<{
    cards: IMaskedCard[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { cards, total } = await this.cardsRepository.findByUserAndProfile(userId, profileId, query, query.includeDeleted);

    const page = query.page || 1;
    const limit = query.limit || 10;
    const totalPages = Math.ceil(total / limit);

    return {
      cards: cards.map(card => this.maskCardDetails(card)),
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * Find card by ID
   */
  async findCardById(cardId: string, userId: string): Promise<IMaskedCard> {
    const card = await this.cardsRepository.findById(cardId);

    if (!card) {
      throw new CardNotFoundException(cardId, this.requestContext.getTraceId());
    }

    await this.validateCardOwnership(card, userId);

    return this.maskCardDetails(card);
  }

  /**
   * Update card
   */
  async updateCard(cardId: string, userId: string, updateCardDto: UpdateCardDto): Promise<IMaskedCard> {
    const traceId = this.requestContext.getTraceId();
    const card = await this.findCardEntityById(cardId, userId);

    // Validate display name uniqueness if being updated
    if (updateCardDto.displayName && updateCardDto.displayName !== card.displayName) {
      await this.validateUniqueDisplayName(updateCardDto.displayName, userId, card.profileId.toString(), cardId);
    }

    // Encrypt last four digits if being updated
    const updateData: any = { ...updateCardDto };
    if (updateCardDto.lastFourDigits) {
      updateData.lastFourDigits = this.encryptionService.encryptLastFourDigits(updateCardDto.lastFourDigits);
    }

    const updatedCard = await this.cardsRepository.update(cardId, updateData);

    if (!updatedCard) {
      throw new CardNotFoundException(cardId, traceId);
    }

    this.logger.log(`Card updated successfully: ${updatedCard.displayName}`, { userId, cardId, traceId });

    return this.maskCardDetails(updatedCard);
  }

  /**
   * Set card as default
   */
  async setDefaultCard(cardId: string, userId: string, profileId: string): Promise<IMaskedCard> {
    const traceId = this.requestContext.getTraceId();
    const card = await this.findCardEntityById(cardId, userId);

    if (!card.isUsable()) {
      throw new InvalidCardOperationException('set as default', `Card is ${card.status.toLowerCase()} or expired`, traceId);
    }

    const updatedCard = await this.cardsRepository.setAsDefault(cardId, userId, profileId);

    if (!updatedCard) {
      throw new CardNotFoundException(cardId, traceId);
    }

    this.logger.log(`Card set as default: ${updatedCard.displayName}`, { userId, cardId, traceId });

    return this.maskCardDetails(updatedCard);
  }

  /**
   * Activate card
   */
  async activateCard(cardId: string, userId: string): Promise<IMaskedCard> {
    const traceId = this.requestContext.getTraceId();
    const card = await this.findCardEntityById(cardId, userId);

    if (card.isExpired()) {
      throw new CardExpiredException(cardId, `${card.expiryMonth}/${card.expiryYear}`, traceId);
    }

    const updatedCard = await this.cardsRepository.update(cardId, { status: CardStatus.ACTIVE });

    if (!updatedCard) {
      throw new CardNotFoundException(cardId, traceId);
    }

    this.logger.log(`Card activated: ${updatedCard.displayName}`, { userId, cardId, traceId });

    return this.maskCardDetails(updatedCard);
  }

  /**
   * Deactivate card
   */
  async deactivateCard(cardId: string, userId: string): Promise<IMaskedCard> {
    const traceId = this.requestContext.getTraceId();
    const card = await this.findCardEntityById(cardId, userId);

    if (card.isDefault) {
      throw new DefaultCardException('deactivate', 'Set another card as default first', traceId);
    }

    const updatedCard = await this.cardsRepository.update(cardId, { status: CardStatus.INACTIVE });

    if (!updatedCard) {
      throw new CardNotFoundException(cardId, traceId);
    }

    this.logger.log(`Card deactivated: ${updatedCard.displayName}`, { userId, cardId, traceId });

    return this.maskCardDetails(updatedCard);
  }

  /**
   * Soft delete card
   */
  async softDeleteCard(cardId: string, userId: string): Promise<void> {
    const traceId = this.requestContext.getTraceId();
    const card = await this.findCardEntityById(cardId, userId);

    if (card.isDefault) {
      throw new DefaultCardException('delete', 'Set another card as default first', traceId);
    }

    // Check if card has linked transactions (this will be implemented when integrating with transactions)
    // For now, we'll allow deletion

    const deleted = await this.cardsRepository.softDelete(cardId, userId);

    if (!deleted) {
      throw new CardDeletionException(cardId, 'Failed to delete card', traceId);
    }

    this.logger.log(`Card deleted: ${card.displayName}`, { userId, cardId, traceId });
  }

  /**
   * Get card balance
   */
  async getCardBalance(cardId: string, userId: string): Promise<CardBalanceEntity> {
    await this.findCardEntityById(cardId, userId); // Validate ownership

    const balance = await this.cardsRepository.findBalance(cardId);

    if (!balance) {
      // Create initial balance if it doesn't exist
      const initialBalance = await this.cardsRepository.upsertBalance(cardId, {
        userId,
        currentBalance: 0,
        isAutomaticUpdate: false
      });

      return initialBalance;
    }

    return balance;
  }

  /**
   * Update card balance
   */
  async updateCardBalance(cardId: string, userId: string, balanceDto: CreateCardBalanceDto): Promise<CardBalanceEntity> {
    const traceId = this.requestContext.getTraceId();
    const card = await this.findCardEntityById(cardId, userId);

    try {
      const balanceData = {
        ...balanceDto,
        cardId: new Types.ObjectId(cardId),
        userId,
        paymentDueDate: balanceDto.paymentDueDate ? new Date(balanceDto.paymentDueDate) : undefined,
        statementStartDate: balanceDto.statementStartDate ? new Date(balanceDto.statementStartDate) : undefined,
        statementEndDate: balanceDto.statementEndDate ? new Date(balanceDto.statementEndDate) : undefined
      };

      const updatedBalance = await this.cardsRepository.upsertBalance(cardId, balanceData);

      // Update utilization rate and available credit for credit cards
      if (card.isCreditCard() && card.creditLimit) {
        updatedBalance.updateUtilizationRate(card.creditLimit);
        updatedBalance.updateAvailableCredit(card.creditLimit);
      }

      // Check overdue status
      updatedBalance.checkOverdueStatus();

      // Save the calculated fields
      await this.cardsRepository.upsertBalance(cardId, {
        utilizationRate: updatedBalance.utilizationRate,
        availableCredit: updatedBalance.availableCredit,
        isOverdue: updatedBalance.isOverdue,
        overdueAmount: updatedBalance.overdueAmount
      });

      this.logger.log(`Card balance updated: ${card.displayName}`, { userId, cardId, traceId });

      return updatedBalance;
    } catch (error) {
      this.logger.error(`Failed to update card balance`, { error: error.message, cardId, userId, traceId });
      throw new CardBalanceUpdateException(cardId, error.message, traceId);
    }
  }

  /**
   * Get payment due summary for all user cards
   */
  async getPaymentDueSummary(userId: string): Promise<IPaymentDueSummary[]> {
    const cards = await this.cardsRepository.findByUser(userId);
    const balances = await this.cardsRepository.findBalancesByUser(userId);

    const balanceMap = new Map(balances.map(b => [b.cardId.toString(), b]));

    const summary: IPaymentDueSummary[] = [];

    for (const card of cards) {
      const balance = balanceMap.get(card._id!.toString());

      if (balance && balance.paymentDueDate && balance.minimumPayment) {
        summary.push({
          cardId: card._id!,
          displayName: card.displayName,
          dueDate: balance.paymentDueDate,
          minimumPayment: balance.minimumPayment,
          currentBalance: balance.currentBalance,
          isOverdue: balance.isOverdue,
          daysUntilDue: balance.getDaysUntilDue()
        });
      }
    }

    return summary.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Get total debt summary across all cards
   */
  async getTotalDebtAcrossCards(userId: string, profileId?: string): Promise<IDebtSummary> {
    const cards = profileId ? (await this.cardsRepository.findByUserAndProfile(userId, profileId)).cards : await this.cardsRepository.findByUser(userId);

    const balances = await this.cardsRepository.findBalancesByUser(userId);
    const balanceMap = new Map(balances.map(b => [b.cardId.toString(), b]));

    let totalDebt = 0;
    let totalMinimumPayment = 0;
    let totalAvailableCredit = 0;
    let totalUtilization = 0;
    let overdueCount = 0;
    let totalOverdueAmount = 0;
    let creditCards = 0;

    for (const card of cards) {
      const balance = balanceMap.get(card._id!.toString());

      if (balance) {
        totalDebt += balance.currentBalance;
        totalMinimumPayment += balance.minimumPayment || 0;

        if (balance.isOverdue) {
          overdueCount++;
          totalOverdueAmount += balance.overdueAmount || 0;
        }

        if (card.isCreditCard() && card.creditLimit) {
          creditCards++;
          totalAvailableCredit += balance.availableCredit || 0;
          totalUtilization += balance.utilizationRate || 0;
        }
      }
    }

    const averageUtilizationRate = creditCards > 0 ? totalUtilization / creditCards : 0;

    return {
      totalDebt,
      totalMinimumPayment,
      totalAvailableCredit,
      averageUtilizationRate,
      cardsCount: cards.length,
      overdueCount,
      totalOverdueAmount
    };
  }

  /**
   * Validate card ownership
   */
  async validateCardOwnership(card: CardEntity, userId: string, profileId?: string): Promise<boolean> {
    if (card.userId !== userId) {
      throw new CardOwnershipException(card._id!.toString(), userId, profileId, this.requestContext.getTraceId());
    }

    if (profileId && card.profileId.toString() !== profileId) {
      throw new CardOwnershipException(card._id!.toString(), userId, profileId, this.requestContext.getTraceId());
    }

    return true;
  }

  /**
   * Mask card details for API responses
   */
  maskCardDetails(card: CardEntity): IMaskedCard {
    let decryptedLastFour: string | undefined;

    if (card.lastFourDigits) {
      try {
        decryptedLastFour = this.encryptionService.decrypt(card.lastFourDigits);
      } catch (error) {
        this.logger.warn(`Failed to decrypt last four digits for card ${card._id}`, { error: error.message });
      }
    }

    return card.toMasked(decryptedLastFour);
  }

  // Private helper methods

  private async findCardEntityById(cardId: string, userId: string): Promise<CardEntity> {
    const card = await this.cardsRepository.findById(cardId);

    if (!card) {
      throw new CardNotFoundException(cardId, this.requestContext.getTraceId());
    }

    await this.validateCardOwnership(card, userId);

    return card;
  }

  private async validateCardLimit(userId: string, profileId: string): Promise<void> {
    // Get profile type (this will need to be implemented when we have profile service integration)
    // For now, we'll use a default limit
    const profileType = 'personal'; // TODO: Get from profile service
    const limit = CARD_LIMITS_BY_ACCOUNT_TYPE[profileType];

    const currentCount = await this.cardsRepository.countByUserAndProfile(userId, profileId);

    if (currentCount >= limit) {
      throw new CardLimitExceededException(profileType, limit, this.requestContext.getTraceId());
    }
  }

  private async validateUniqueDisplayName(displayName: string, userId: string, profileId: string, excludeCardId?: string): Promise<void> {
    const isUnique = await this.cardsRepository.isDisplayNameUnique(displayName, userId, profileId, excludeCardId);

    if (!isUnique) {
      throw new DuplicateCardNameException(displayName, profileId, this.requestContext.getTraceId());
    }
  }

  private async createInitialBalance(cardId: string, creditLimit?: number): Promise<void> {
    const initialBalanceData = {
      cardId: new Types.ObjectId(cardId),
      userId: this.requestContext.getUserId()!,
      currentBalance: 0,
      availableCredit: creditLimit || 0,
      isAutomaticUpdate: false
    };

    await this.cardsRepository.upsertBalance(cardId, initialBalanceData);
  }
}
