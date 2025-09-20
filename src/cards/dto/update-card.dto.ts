import { CardStatus } from '@common/constants/card-types';
import { OmitType, PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateCardDto } from './create-card.dto';

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
