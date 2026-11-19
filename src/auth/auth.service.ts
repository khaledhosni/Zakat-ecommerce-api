
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class AuthService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}


    private hash(token: string): string {
      return createHash('sha256').update(token).digest('hex');
    }
  

  async register(dto: RegisterDto) {

    // 1. Normalize email
    const email = dto.email.trim().toLowerCase();

    // 2. Check whether email already exists
    const existingUser = await this.prisma.users.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // 4. Find CUSTOMER role
    const customerRole = await this.prisma.roles.findUnique({
      where: {
        role_name: 'CUSTOMER',
      },
    });

    if (!customerRole) {
      throw new InternalServerErrorException(
        'CUSTOMER role is not configured',
      );
    }

    // 5. Create user and assign role atomically
    try {
      const user = await this.prisma.$transaction(async (tx) => {

        const newUser = await tx.users.create({
          data: {
            full_name: dto.full_name.trim(),
            email,
            password_hash: passwordHash,
            phone: dto.phone,
          },
        });

        await tx.user_roles.create({
          data: {
            user_id: newUser.user_id,
            role_id: customerRole.role_id,
          },
        });

        return newUser;
      });

      // 6. Return safe response
      return {
        user_id: user.user_id.toString(),
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        is_active: user.is_active,
        roles: ['CUSTOMER'],
      };

    } catch (error) {

      // Handle concurrent registrations with same email
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }



  async login(dto: LoginDto) {

    // STEP 1: Normalize email
    const email = dto.email.trim().toLowerCase();

    // STEP 2: Find user
    const user = await this.prisma.users.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    // STEP 3: Verify user exists
    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    // STEP 4: Compare password
    const passwordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    // STEP 5: Check account status
    if (!user.is_active) {
      throw new UnauthorizedException(
        'Account is inactive',
      );
    }

    // STEP 6: Get role assignments
    const userRoles = await this.prisma.user_roles.findMany({
      where: {
        user_id: user.user_id,
      },
      select: {
        role_id: true,
      },
    });

    // STEP 7: Get role names
    const roles = await this.prisma.roles.findMany({
      where: {
        role_id: {
          in: userRoles.map(ur => ur.role_id),
        },
      },
      select: {
        role_name: true,
      },
    });

    // STEP 8: Prepare JWT payload
    const payload = {
      sub: user.user_id.toString(),
      email: user.email,
      roles: roles.map(r => r.role_name),
    };

    // STEP 9: Generate access token
    // const accessToken =
    //   await this.jwtService.signAsync(payload);

    //   const refreshToken = await this.refreshTokens.create(user.user_id);
   


   const {refresh_token: refreshToken, access_token: accessToken, expires_in: expiresIn}= await this.createTokens(user.user_id, user.email, payload.roles);
     // add refresh token to database 
      // STEP 10: Return response
    return {
      refresh_token: refreshToken,  
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,

      user: {
        user_id: user.user_id.toString(),
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        roles: payload.roles,
      },
    };
  }



  // 2. Generate both tokens
  private async createTokens(
    id: bigint,
    email: string,
    roles: string[],
    oldHash?: string,
  ) {
    const access_token = await this.jwtService.signAsync(
      {
        sub: id.toString(),
        email,
        roles,
      },
      {
        secret: process.env.JWT_SECRET!,
        expiresIn: '15m',
      },
    );

    const refresh_token = await this.jwtService.signAsync(
      {
        sub: id.toString(),
        type: 'refresh',
        jti: randomUUID(),
      },
      {
        secret: process.env.JWT_REFRESH_SECRET!,
        expiresIn: '7d',
      },
    );

    const newHash = this.hash(refresh_token);

    if (oldHash) {
      // Replace the old token only if it is still valid
      const result = await this.prisma.users.updateMany({
        where: {
          user_id: id,
          refresh_token_hash: oldHash,
        },
        data: {
          refresh_token_hash: newHash,
        },
      });

      if (result.count !== 1) {
        throw new UnauthorizedException('Token already used');
      }
    } else {
      // First login: save the refresh-token hash
      await this.prisma.users.update({
        where: { user_id: id },
        data: {
          refresh_token_hash: newHash,
        },
      });
    }

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: 900,
    };
  }


    async refresh(token: string) {
    let payload: { sub: string; type: string };

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_REFRESH_SECRET!,
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired refresh token',
      );
    }

    if (
      payload.type !== 'refresh' ||
      !/^\d+$/.test(payload.sub)
    ) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.prisma.users.findUnique({
      where: {
        user_id: BigInt(payload.sub),
      },
      include: {
        user_roles: {
          include: { roles: true },
        },
      },
    });

    const oldHash = this.hash(token);

    if (
      !user?.is_active ||
      user.refresh_token_hash !== oldHash
    ) {
      throw new UnauthorizedException('Token revoked');
    }

    const roles = user.user_roles.map(
      r => r.roles.role_name,
    );

    return this.createTokens(
      user.user_id,
      user.email,
      roles,
      oldHash,
    );
  }
}
