import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole, AccountRole } from '../constants/user-roles';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has any of the required roles
    const hasRole = requiredRoles.some((role) => {
      // Check global user role
      if (user.role === role) {
        return true;
      }

      // Check account-specific roles
      if (user.accountRoles && Array.isArray(user.accountRoles)) {
        return user.accountRoles.some((accountRole: any) => 
          accountRole.role === role
        );
      }

      return false;
    });

    if (!hasRole) {
      this.logger.warn(`Access denied for user ${user.id}`, {
        userId: user.id,
        userRoles: user.role,
        accountRoles: user.accountRoles,
        requiredRoles,
        path: context.switchToHttp().getRequest().url,
      });

      throw new ForbiddenException(
        `Insufficient privileges. Required roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}