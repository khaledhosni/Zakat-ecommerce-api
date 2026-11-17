import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { RolesGuard } from '../auth/guards/roles/roles.guard.js';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard(['ADMIN']))
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  private parseId(id: string): bigint {
    if (!/^[1-9]\d*$/.test(id)) {
      throw new BadRequestException('Invalid customer ID');
    }
    const parsed = BigInt(id);
    if (parsed > 9223372036854775807n) {
      throw new BadRequestException('Customer ID is out of range');
    }
    return parsed;
  }

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(this.parseId(id));
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(this.parseId(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customersService.remove(this.parseId(id));
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.customersService.activate(this.parseId(id));
  }
}
