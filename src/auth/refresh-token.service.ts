
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generate(): string {
    return randomBytes(32).toString('hex');
  }

  // Called after a successful login
  async create(userId: bigint) {
    const token = this.generate();

    await this.prisma.refresh_sessions.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        token_hash: this.hash(token),
        expires_at: new Date(Date.now() + SEVEN_DAYS),
      },
    });

    return token;
  }

  // Called by POST /auth/refresh
  async rotate(oldToken: string) {
    const oldHash = this.hash(oldToken);
    const newToken = this.generate();
    const newHash = this.hash(newToken);

    // Atomic compare-and-replace: only one request can rotate this token.
    const changed = await this.prisma.refresh_sessions.updateMany({
      where: {
        token_hash: oldHash,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      data: {
        token_hash: newHash,
      },
    });

    if (changed.count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.refresh_sessions.findUnique({
      where: { token_hash: newHash },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh session');
    }

    return { token: newToken, userId: session.user_id };
  }

  // Called by POST /auth/logout
  async revoke(token: string) {
    await this.prisma.refresh_sessions.updateMany({
      where: { token_hash: this.hash(token) },
      data: { revoked_at: new Date() },
    });
  }
}
