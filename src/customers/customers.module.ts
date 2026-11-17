import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [CustomersService, JwtAuthGuard],
})
export class CustomersModule {}
