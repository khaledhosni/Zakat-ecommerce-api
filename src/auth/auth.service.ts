
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

@Injectable()
export class AuthService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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
    const accessToken =
      await this.jwtService.signAsync(payload);

    // STEP 10: Return response
    return {
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

}
