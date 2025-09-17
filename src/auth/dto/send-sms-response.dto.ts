import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for SMS sending operation
 */
export class SendSmsResponseDto {
  @ApiProperty({
    description: 'Whether the SMS was sent successfully',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Human-readable message about the operation',
    example: 'Verification code sent successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Unique verification ID to be used when verifying the code',
    example: 'ver_abc123def456789_1640995200000'
  })
  verificationId: string;

  @ApiProperty({
    description: 'Expiration time for the verification code (ISO 8601)',
    example: '2023-12-31T23:59:59.000Z'
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'AWS SNS Message ID (only present if SMS was actually sent)',
    example: 'f12345ab-cdef-1234-5678-90abcdef1234',
    required: false
  })
  messageId?: string;
}
