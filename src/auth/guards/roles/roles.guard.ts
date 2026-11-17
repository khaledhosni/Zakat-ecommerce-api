
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email: string;
    roles: string[];
  };
}

export function RolesGuard(allowedRoles: string[]) {

  return class implements CanActivate {

    canActivate(context: ExecutionContext): boolean {

      // 1. Get HTTP request
      const request = context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

      // 2. Get authenticated user
      const user = request.user;

      // 3. Check authentication
      if (!user) {
        throw new UnauthorizedException(
          'Authentication required',
        );
      }

      // 4. Check whether any user role is allowed
      const hasPermission =
        Array.isArray(user.roles) &&
        user.roles.some(role =>
          allowedRoles.includes(role)
        );

      // 5. Deny access
      if (!hasPermission) {
        throw new ForbiddenException(
          'Insufficient permissions',
        );
      }

      // 6. Allow access
      return true;
    }
  };
}
