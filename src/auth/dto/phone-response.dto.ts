import { ApiProperty } from '@nestjs/swagger';

export class PhoneVerificationResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indicates if the operation was successful'
  })
  success: boolean;

  @ApiProperty({
    example: 'Phone number verified successfully',
    description: 'Success message'
  })
  message: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'The verified phone number'
  })
  phoneNumber: string;
}

export class PhoneRemovalResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indicates if the operation was successful'
  })
  success: boolean;

  @ApiProperty({
    example: 'Phone number removed successfully',
    description: 'Success message'
  })
  message: string;
}
