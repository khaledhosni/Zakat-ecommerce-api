import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // PostgreSQL BIGINT is not JSON serializable; never expose password_hash.
  private toResponse(user: {
    user_id: bigint;
    full_name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    created_at: Date;
  }, roles: string[]) {
    return {
      user_id: user.user_id.toString(),
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      is_active: user.is_active,
      created_at: user.created_at,
      roles,
    };
  }

  private async customerRoleId(): Promise<number> {
    const role = await this.prisma.roles.findUnique({
      where: { role_name: 'CUSTOMER' },
    });
    if (!role) {
      throw new InternalServerErrorException('CUSTOMER role is not configured');
    }
    return role.role_id;
  }

  private async requireCustomer(userId: bigint) {
    const customerRoleId = await this.customerRoleId();
    const assignment = await this.prisma.user_roles.findUnique({
      where: {
        user_id_role_id: {
          user_id: userId,
          role_id: customerRoleId,
        },
      },
    });
    if (!assignment) throw new NotFoundException('Customer not found');
    const user = await this.prisma.users.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true, full_name: true, email: true,
        phone: true, is_active: true, created_at: true,
      },
    });
    if (!user) throw new NotFoundException('Customer not found');
    return user;
  }

  private async rolesForUsers(userIds: bigint[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (userIds.length === 0) return result;

    const assignments = await this.prisma.user_roles.findMany({
      where: { user_id: { in: userIds } },
      select: { user_id: true, role_id: true },
    });
    const roleIds = [...new Set(assignments.map(a => a.role_id))];
    const roles = await this.prisma.roles.findMany({
      where: { role_id: { in: roleIds } },
      select: { role_id: true, role_name: true },
    });
    const roleNames = new Map(roles.map(r => [r.role_id, r.role_name]));
    for (const a of assignments) {
      const key = a.user_id.toString();
      const name = roleNames.get(a.role_id);
      if (name) result.set(key, [...(result.get(key) ?? []), name]);
    }
    return result;
  }

  // GET /customers — only users assigned CUSTOMER (including dual-role users).
  async findAll() {
    const roleId = await this.customerRoleId();
    const assignments = await this.prisma.user_roles.findMany({
      where: { role_id: roleId },
      select: { user_id: true },
    });
    const ids = assignments.map(a => a.user_id);
    if (ids.length === 0) return [];

    const users = await this.prisma.users.findMany({
      where: { user_id: { in: ids } },
      select: {
        user_id: true, full_name: true, email: true,
        phone: true, is_active: true, created_at: true,
      },
      orderBy: { user_id: 'asc' },
    });
    const roles = await this.rolesForUsers(users.map(u => u.user_id));
    return users.map(u => this.toResponse(u, roles.get(u.user_id.toString()) ?? []));
  }

  // GET /customers/:id
  async findOne(id: bigint) {
    const user = await this.requireCustomer(id);
    const roles = await this.rolesForUsers([id]);
    return this.toResponse(user, roles.get(id.toString()) ?? []);
  }

  // POST /customers — create account and CUSTOMER assignment atomically.
  async create(dto: CreateCustomerDto) {
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.full_name.trim();
    if (!fullName) throw new BadRequestException('Full name cannot be blank');

    const existing = await this.prisma.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { user_id: true },
    });
    if (existing) throw new ConflictException('Email already registered');

    const customerRoleId = await this.customerRoleId();
    const hash = await bcrypt.hash(dto.password, 12);
    try {
      const created = await this.prisma.$transaction(async tx => {
        const user = await tx.users.create({
          data: {
            full_name: fullName,
            email,
            password_hash: hash,
            phone: dto.phone,
          },
          select: {
            user_id: true, full_name: true, email: true,
            phone: true, is_active: true, created_at: true,
          },
        });
        await tx.user_roles.create({
          data: { user_id: user.user_id, role_id: customerRoleId },
        });
        return user;
      });
      return this.toResponse(created, ['CUSTOMER']);
    } catch (error) {
      if (this.isPrismaCode(error, 'P2002')) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  // PATCH /customers/:id
  async update(id: bigint, dto: UpdateCustomerDto) {
    await this.requireCustomer(id);
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }
    const fullName = dto.full_name?.trim();
    if (fullName !== undefined && !fullName) {
      throw new BadRequestException('Full name cannot be blank');
    }
    const email = dto.email?.trim().toLowerCase();
    if (email !== undefined) {
      const match = await this.prisma.users.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { user_id: true },
      });
      if (match && match.user_id !== id) {
        throw new ConflictException('Email already registered');
      }
    }

    try {
      const updated = await this.prisma.users.update({
        where: { user_id: id },
        data: {
          ...(fullName !== undefined ? { full_name: fullName } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
        },
        select: {
          user_id: true, full_name: true, email: true,
          phone: true, is_active: true, created_at: true,
        },
      });
      const roles = await this.rolesForUsers([id]);
      return this.toResponse(updated, roles.get(id.toString()) ?? []);
    } catch (error) {
      if (this.isPrismaCode(error, 'P2002')) {
        throw new ConflictException('Email already registered');
      }
      if (this.isPrismaCode(error, 'P2025')) {
        throw new NotFoundException('Customer not found');
      }
      throw error;
    }
  }

  // DELETE /customers/:id — soft delete, preserves historical orders.
  async remove(id: bigint) {
    return this.update(id, { is_active: false });
  }

  // PATCH /customers/:id/activate — optional administrative convenience.
  async activate(id: bigint) {
    return this.update(id, { is_active: true });
  }

  private isPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null &&
      'code' in error && error.code === code;
  }
}
