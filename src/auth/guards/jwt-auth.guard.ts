import { JwtAuthGuard as CommonJwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Injectable } from '@nestjs/common';

/**
 * JWT Authentication Guard
 * Re-exports the common JWT guard for local auth module usage
 */
@Injectable()
export class JwtAuthGuard extends CommonJwtAuthGuard {}
