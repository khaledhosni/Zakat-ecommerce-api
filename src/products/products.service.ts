import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProductsService {

    constructor(private readonly prisma: PrismaService) {}
 async findAll() {
    let products = await this.prisma.products.findMany({
      select: {
        product_id: true,
        product_name: true,
        price: true,
        is_active: true,
      },
    });

    return products.map(product => ({
    product_id: product.product_id.toString(),
    product_name: product.product_name,
    price: product.price.toString(),
    is_active: product.is_active,
    }));
  }


}
