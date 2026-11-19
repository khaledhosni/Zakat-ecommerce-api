
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { serializeOrder } from './order.serializer.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}



  private parseId(id: string): bigint {
    if (!/^[1-9]\d*$/.test(id)) {
      throw new BadRequestException('Invalid ID');
    }
    return BigInt(id);
  }
  async create(
    userId: string,
    dto: CreateOrderDto,
  ) {
    // 1. Safely convert JWT user ID to BigInt.
    if (!/^[1-9]\d*$/.test(userId)) {
      throw new BadRequestException(
        'Invalid customer ID',
      );
    }

    const customerId = BigInt(userId);

    // 2. Reject duplicate products in one request.
    const ids = dto.items.map(item => item.product_id);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Duplicate products are not allowed',
      );
    }

    // 3. One transaction for all database operations.
    return this.prisma.$transaction(async (tx) => {

      // Check customer.
      const customer = await tx.users.findUnique({
        where: { user_id: customerId },
      });

      if (!customer || !customer.is_active) {
        throw new BadRequestException(
          'Customer is inactive or does not exist',
        );
      }

      // 4. Load products and actual prices.
      const items = [];

      let total = new Prisma.Decimal(0);

      for (const item of dto.items) {
        if (!/^[1-9]\d*$/.test(item.product_id)) {
          throw new BadRequestException(
            'Invalid product ID',
          );
        }

        const productId = BigInt(item.product_id);

        const product = await tx.products.findUnique({
          where: { product_id: productId },
        });

        if (!product || !product.is_active) {
          throw new NotFoundException(
            `Product ${item.product_id} is unavailable`,
          );
        }

        const price = new Prisma.Decimal(
          product.price.toString(),
        );

        const subtotal = price.mul(item.quantity);

        total = total.plus(subtotal);

        items.push({
          product_id: productId,
          quantity: item.quantity,
          unit_price: price,
        });
      }

      // 5. Create order header.
      const order = await tx.orders.create({
        data: {
          user_id: customerId,
          status: 'PENDING',
          total_amount: total,
        },
      });

      // 6. Create order items.
      await tx.order_items.createMany({
        data: items.map(item => ({
          order_id: order.order_id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      });

      // 7. Return a JSON-safe response.
      return {
        order_id: order.order_id.toString(),
        user_id: order.user_id.toString(),
        status: order.status,
        total_amount: total.toString(),
        created_at: order.created_at,
        items: items.map(item => ({
          product_id: item.product_id.toString(),
          quantity: item.quantity,
          unit_price: item.unit_price.toString(),
        })),
      };
    });
  }


  async findMyOrders(userId: string) {
  const customerId = this.parseId(userId);

  const orders = await this.prisma.orders.findMany({
    where: {
      user_id: customerId,
    },

    include: {
      order_items: true,
    },

    orderBy: {
      created_at: 'desc',
    },
  });

    return orders.map(serializeOrder);
    }




async findAll() {
  const orders = await this.prisma.orders.findMany({
    include: {
      order_items: true,
    },

    orderBy: [
      { created_at: 'desc' },
      { order_id: 'desc' },
    ],
  });

  return orders.map(serializeOrder);
}



async findOne(
  orderId: string,
  currentUserId: string,
  roles: string[],
) {
  const id = this.parseId(orderId);
  const userId = this.parseId(currentUserId);

  const isAdmin = roles.includes('ADMIN');

  const order = await this.prisma.orders.findFirst({
    where: {
      order_id: id,

      // Admin: filter only by order ID.
      // Customer: also filter by authenticated user ID.
      ...(isAdmin ? {} : { user_id: userId }),
    },

    include: {
      order_items: true,
    },
  });

  if (!order) {
    throw new NotFoundException(
      'Order not found',
    );
  }

  return serializeOrder(order);
}

}
