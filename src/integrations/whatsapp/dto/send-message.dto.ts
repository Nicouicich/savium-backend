import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Phone number in international format (e.g., +1234567890)',
    example: '+1234567890'
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in international format with + prefix'
  })
  to: string;

  @ApiProperty({
    description: 'Message text to send',
    example: 'Hello! This is a test message from Savium.'
  })
  @IsNotEmpty()
  @IsString()
  message: string;
}

export class SendMessageResponseDto {
  @ApiProperty({ description: 'Whether the message was sent successfully' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Recipient phone number' })
  to: string;

  @ApiProperty({ description: 'Message send timestamp' })
  timestamp: string;

  @ApiProperty({ description: 'Request trace ID' })
  traceId: string;
}
