import { ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local Authentication Guard
 * Validates username/password for login endpoints
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  private readonly logger = new Logger(LocalAuthGuard.name);

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (err || !user) {
      // Log authentication failures for security monitoring
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Local authentication failed for ${request.url}`, {
          error: err?.message,
          info: info?.message,
          email: request.body?.email,
          ip: request.ip
        });
      }

      throw err || new UnauthorizedException('Invalid credentials');
    }

    // Add user to request object
    request.user = user;
    return user;
  }
}
