
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {

  constructor(
    private readonly prisma: PrismaService,
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
}
