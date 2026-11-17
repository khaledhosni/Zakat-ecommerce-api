import { Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles/roles.guard.js';

@Controller('products')
@UseGuards(JwtAuthGuard
)
export class ProductsController {

    constructor(private readonly productsService: ProductsService) {}


    // Add your route handlers here, for example:
    @Get()
    @UseGuards(RolesGuard(['ADMIN', 'CUSTOMER']))
    findAll() {
      return this.productsService.findAll();
    }



  // ADMIN and CUSTOMER
  @Get(':id')
  @UseGuards(RolesGuard(['ADMIN', 'CUSTOMER']))
  findOne() {
    return 'Product details';
  }

  // ADMIN only
  @Post()
  @UseGuards(RolesGuard(['ADMIN']))
  create() {
    return 'Product created';
  }

  // ADMIN only
  @Patch(':id')
  @UseGuards(RolesGuard(['ADMIN']))
  update() {
    return 'Product updated';
  }

  // ADMIN only
  @Delete(':id')
  @UseGuards(RolesGuard(['ADMIN']))
  remove() {
    return 'Product deactivated';
  }

}
