
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // Convert Prisma product into JSON-safe response
  private formatProduct(product: {
    product_id: bigint;
    product_name: string;
    description: string | null;
    price: { toString(): string };
    is_active: boolean;
    created_at: Date;
  }) {
    return {
      product_id: product.product_id.toString(),
      product_name: product.product_name,
      description: product.description,
      price: product.price.toString(),
      is_active: product.is_active,
      created_at: product.created_at,
    };
  }

  // GET /products
  async findAll(isAdmin: boolean) {

    const products = await this.prisma.products.findMany({
      where: isAdmin ? {} : { is_active: true },
      orderBy: {
        product_id: 'asc',
      },
    });

    return products.map(product =>
      this.formatProduct(product)
    );
  }

  // GET /products/:id
  async findOne(id: bigint, isAdmin: boolean) {

    const product = await this.prisma.products.findFirst({
      where: {
        product_id: id,
        ...(isAdmin ? {} : { is_active: true }),
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.formatProduct(product);
  }

  // POST /products
  async create(dto: CreateProductDto) {

    const name = dto.product_name.trim();

    if (!name) {
      throw new BadRequestException(
        'Product name cannot be empty',
      );
    }

    const product = await this.prisma.products.create({
      data: {
        product_name: name,
        description: dto.description,
        price: dto.price,
        is_active: dto.is_active ?? true,
      },
    });

    return this.formatProduct(product);
  }

  // PATCH /products/:id
  async update(id: bigint, dto: UpdateProductDto) {

    await this.findOne(id, true);

    const name = dto.product_name?.trim();

    if (name !== undefined && !name) {
      throw new BadRequestException(
        'Product name cannot be empty',
      );
    }

    const product = await this.prisma.products.update({
      where: {
        product_id: id,
      },
      data: {
        ...(name !== undefined && {
          product_name: name,
        }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.price !== undefined && {
          price: dto.price,
        }),
        ...(dto.is_active !== undefined && {
          is_active: dto.is_active,
        }),
      },
    });

    return this.formatProduct(product);
  }

  // DELETE /products/:id
  async remove(id: bigint) {

    await this.findOne(id, true);

    const product = await this.prisma.products.update({
      where: {
        product_id: id,
      },
      data: {
        is_active: false,
      },
    });

    return this.formatProduct(product);
  }
}
