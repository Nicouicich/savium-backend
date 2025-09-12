import { IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: 'New account type for the subscription',
    example: 'family',
    enum: ['personal', 'couple', 'family', 'business']
  })
  @IsOptional()
  @IsEnum(['personal', 'couple', 'family', 'business'])
  newAccountType?: string;

  @ApiPropertyOptional({
    description: 'Proration behavior when changing plans',
    example: 'create_prorations',
    enum: ['create_prorations', 'none', 'always_invoice'],
    default: 'create_prorations'
  })
  @IsOptional()
  @IsEnum(['create_prorations', 'none', 'always_invoice'])
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';

  @ApiPropertyOptional({
    description: 'Additional metadata to update',
    example: { reason: 'user_upgrade', source: 'dashboard' }
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
