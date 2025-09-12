import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto';

export class TokensDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Access token expiration time',
    example: '2024-01-01T01:00:00.000Z'
  })
  expiresIn: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'User information',
    type: UserResponseDto
  })
  user: UserResponseDto;

  @ApiProperty({
    description: 'Authentication tokens',
    type: TokensDto
  })
  tokens: TokensDto;
}
