import { PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateCardDto } from './create-card.dto';
import { CardStatus } from '@common/constants/card-types';

export class UpdateCardDto extends PartialType(OmitType(CreateCardDto, ['profileId'] as const)) {
  @ApiPropertyOptional({
    description: 'Card status',
    enum: CardStatus,
    example: CardStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(CardStatus, { message: 'Invalid card status' })
  status?: CardStatus;
}
