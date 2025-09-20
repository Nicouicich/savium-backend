import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class WhatsAppMetadataDto {
  @ApiProperty({ description: 'WhatsApp Business phone number ID' })
  @IsString()
  phone_number_id?: string;

  @ApiProperty({ description: 'Display phone number' })
  @IsString()
  display_phone_number?: string;
}

export class WhatsAppContactDto {
  @ApiProperty({ description: 'Contact profile information' })
  @IsOptional()
  profile?: Record<string, any>;

  @ApiProperty({ description: 'WhatsApp user ID' })
  wa_id?: string;
}

export class WhatsAppMessageDto {
  @ApiProperty({ description: 'Message ID' })
  id?: string;

  @ApiProperty({ description: 'Sender phone number' })
  from: string;

  @ApiProperty({ description: 'Message timestamp' })
  timestamp?: string;

  @ApiProperty({ description: 'Message text content' })
  text?: { body: string };

  @ApiProperty({ description: 'Message type' })
  type?: string;

  @ApiProperty({ description: 'Message caption for media' })
  caption?: string;

  @ApiProperty({ description: 'Image message content' })
  image?: Record<string, any>;

  @ApiProperty({ description: 'Document message content' })
  document?: Record<string, any>;

  @ApiProperty({ description: 'Audio message content' })
  audio?: Record<string, any>;

  @ApiProperty({ description: 'Video message content' })
  video?: Record<string, any>;
}

export class WhatsAppStatusDto {
  @ApiProperty({ description: 'Message ID' })
  @IsOptional()
  id?: string;

  @ApiProperty({ description: 'Status of the message (sent, delivered, read, failed)' })
  @IsOptional()
  status?: string;

  @ApiProperty({ description: 'Timestamp of status update' })
  @IsOptional()
  timestamp?: string;

  @ApiProperty({ description: 'Recipient ID' })
  @IsOptional()
  recipient_id?: string;

  @ApiProperty({ description: 'Conversation information', required: false })
  @IsOptional()
  conversation?: Record<string, any>;

  @ApiProperty({ description: 'Pricing information', required: false })
  @IsOptional()
  pricing?: Record<string, any>;
}

export class WhatsAppValueDto {
  @ApiProperty({ description: 'Messaging product identifier' })
  @IsString()
  @IsOptional()
  messaging_product?: string;

  @ApiProperty({ description: 'WhatsApp metadata', type: WhatsAppMetadataDto })
  @IsOptional()
  metadata?: WhatsAppMetadataDto;

  @ApiProperty({ description: 'Contact information', type: [WhatsAppContactDto] })
  @Type(() => WhatsAppContactDto)
  @IsOptional()
  contacts?: WhatsAppContactDto[];

  @ApiProperty({ description: 'WhatsApp messages', type: [WhatsAppMessageDto] })
  @Type(() => WhatsAppMessageDto)
  messages: WhatsAppMessageDto[];

  @ApiProperty({ description: 'Message statuses', type: [WhatsAppStatusDto] })
  @Type(() => WhatsAppStatusDto)
  @IsOptional()
  statuses?: WhatsAppStatusDto[];
}

export class WhatsAppChangeDto {
  @ApiProperty({ description: 'Change value', type: WhatsAppValueDto })
  @Type(() => WhatsAppValueDto)
  value: WhatsAppValueDto;

  @ApiProperty({ description: 'Field that changed' })
  /* @IsString() */
  @IsOptional()
  field?: string;
}

export class WhatsAppEntryDto {
  @ApiProperty({ description: 'WhatsApp Business Account ID' })
  id: string;

  @ApiProperty({ description: 'Changes array', type: [WhatsAppChangeDto] })
  @Type(() => WhatsAppChangeDto)
  changes: WhatsAppChangeDto[];
}

export class WhatsAppWebhookDto {
  @ApiProperty({ description: 'Object type (always "whatsapp_business_account")' })
  @IsOptional()
  object?: string;

  @ApiProperty({ description: 'Entry array containing webhook data', type: [WhatsAppEntryDto] })
  @IsArray()
  @Type(() => WhatsAppEntryDto)
  entry: WhatsAppEntryDto[];

  /**
   * Helper method to extract all messages from the nested webhook structure
   * Eliminates the need for 3 nested loops in the service
   */
  getMessages(): WhatsAppMessageDto[] {
    const messages: WhatsAppMessageDto[] = this?.entry?.flatMap(entry =>
      entry?.changes?.flatMap((data: WhatsAppChangeDto) => data?.value?.messages?.map(msg => msg))
    );
    return messages;
  }
}
