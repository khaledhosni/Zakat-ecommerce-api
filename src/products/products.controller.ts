import { Controller, Get } from '@nestjs/common';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {

    constructor(private readonly productsService: ProductsService) {}


    // Add your route handlers here, for example:
    @Get()
    findAll() {
      return this.productsService.findAll();
    }

}
