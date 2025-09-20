import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (err || !user) {
      // Only log authentication failures that are not expected token issues
      // Common token issues (expired, malformed, missing) are expected and don't need logging
      const isExpectedTokenIssue = info?.message && (
        info.message.includes('jwt expired')
        || info.message.includes('invalid token')
        || info.message.includes('jwt malformed')
        || info.message.includes('No auth token')
      );

      if (!isExpectedTokenIssue && process.env.NODE_ENV === 'development') {
        this.logger.debug(`Authentication failed for ${request.url}`, {
          error: err?.message,
          info: info?.message,
          ip: request.ip
        });
      }

      throw err || new UnauthorizedException('Authentication required');
    }

    // Add user to request object
    request.user = user;
    return user;
  }
}
