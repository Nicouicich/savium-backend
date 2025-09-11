import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { TokenBlacklistService } from '../services/token-blacklist.service';

@Injectable()
export class TokenBlacklistGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(TokenBlacklistGuard.name);

  constructor(
    private reflector: Reflector,
    private tokenBlacklistService: TokenBlacklistService
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, run the standard JWT authentication
    const canActivate = await super.canActivate(context);
    
    if (!canActivate) {
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromRequest(request);
    
    if (!token) {
      this.logger.warn('No token found in request');
      return false;
    }

    const user = request.user as any;
    const userId = user?.id || user?.sub;

    // Check if the specific token is blacklisted
    const isTokenBlacklisted = await this.tokenBlacklistService.isTokenBlacklisted(token);
    
    if (isTokenBlacklisted) {
      this.logger.warn(`Blacklisted token used by user ${userId}`, {
        userId,
        endpoint: `${request.method} ${request.path}`,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });
      throw new UnauthorizedException('Token has been blacklisted');
    }

    // Check if all tokens for the user are blacklisted (e.g., due to password change)
    if (userId) {
      const areAllTokensBlacklisted = await this.tokenBlacklistService.areAllUserTokensBlacklisted(userId);
      
      if (areAllTokensBlacklisted) {
        this.logger.warn(`All tokens blacklisted for user ${userId}`, {
          userId,
          endpoint: `${request.method} ${request.path}`,
          userAgent: request.headers['user-agent'],
          ip: request.ip
        });
        throw new UnauthorizedException('All user tokens have been invalidated. Please log in again.');
      }
    }

    return true;
  }

  private extractTokenFromRequest(request: Request): string | null {
    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    return null;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Handle JWT validation errors
    if (err || !user) {
      const request = context.switchToHttp().getRequest<Request>();
      
      this.logger.warn('JWT authentication failed', {
        error: err?.message || 'No user',
        info: info?.message,
        endpoint: `${request.method} ${request.path}`,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });
      
      throw err || new UnauthorizedException('Invalid token');
    }
    
    return user;
  }
}