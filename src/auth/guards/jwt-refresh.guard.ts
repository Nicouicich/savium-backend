import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Refresh Guard
 * Validates JWT refresh tokens for token refresh endpoints
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  private readonly logger = new Logger(JwtRefreshGuard.name);

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (err || !user) {
      // Log refresh token failures for security monitoring
      const isExpectedTokenIssue =
        info?.message &&
        (info.message.includes('jwt expired') ||
          info.message.includes('invalid token') ||
          info.message.includes('jwt malformed') ||
          info.message.includes('No auth token'));

      if (!isExpectedTokenIssue && process.env.NODE_ENV === 'development') {
        this.logger.debug(`Refresh token validation failed for ${request.url}`, {
          error: err?.message,
          info: info?.message,
          ip: request.ip
        });
      }

      throw err || new UnauthorizedException('Invalid refresh token');
    }

    // Add user to request object
    request.user = user;
    return user;
  }
}
