
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import type {
  AuthenticatedRequest,
  JwtPayload,
} from '../../interface/authentecated-request.interface.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {

  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    // Get HTTP request
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    // Read Authorization header
    const authorization = request.headers.authorization;

    // Extract Bearer token
    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Bearer token required',
      );
    }

    try {
      // Verify signature and expiration
      const payload =
        await this.jwtService.verifyAsync<JwtPayload>(token);

      // Validate expected payload fields
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        !Array.isArray(payload.roles) ||
        !payload.roles.every(role => typeof role === 'string')
      ) {
        throw new Error('Invalid JWT payload');
      }

      // Store authenticated user claims
      request.user = payload;

    } catch(error) {
      console.error('JWT ERROR:', error);
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }

    return true;
  }
}
