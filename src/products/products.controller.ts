
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles/roles.guard.js';


type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    email: string;
    roles: string[];
  };
};

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {

  constructor(
    private readonly productsService: ProductsService,
  ) {}

  // Convert URL parameter to PostgreSQL BIGINT
  private parseId(id: string): bigint {

    if (!/^[1-9]\d*$/.test(id)) {
      throw new BadRequestException(
        'Invalid product ID',
      );
    }

    const productId = BigInt(id);

    if (productId > 9223372036854775807n) {
      throw new BadRequestException(
        'Product ID is out of range',
      );
    }

    return productId;
  }

  // GET /products
  @Get()
  @UseGuards(RolesGuard(['ADMIN', 'CUSTOMER']))
  findAll(@Req() request: AuthenticatedRequest) {

    const isAdmin = request.user.roles.includes('ADMIN');

    return this.productsService.findAll(isAdmin);
  }

  // GET /products/:id
  @Get(':id')
  @UseGuards(RolesGuard(['ADMIN', 'CUSTOMER']))
  findOne(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {

    const isAdmin = request.user.roles.includes('ADMIN');

    return this.productsService.findOne(
      this.parseId(id),
      isAdmin,
    );
  }

  // POST /products
  @Post()
  @UseGuards(RolesGuard(['ADMIN']))
  create(@Body() dto: CreateProductDto) {

    return this.productsService.create(dto);
  }

  // PATCH /products/:id
  @Patch(':id')
  @UseGuards(RolesGuard(['ADMIN']))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {

    return this.productsService.update(
      this.parseId(id),
      dto,
    );
  }

  // DELETE /products/:id
  @Delete(':id')
  @UseGuards(RolesGuard(['ADMIN']))
  remove(@Param('id') id: string) {

    return this.productsService.remove(
      this.parseId(id),
    );
  }
}
