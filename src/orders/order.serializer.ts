
import { Prisma } from '../generated/prisma/client.js';

// Shape of an order returned with its items included.
export type OrderWithItems = {
  order_id: bigint;
  user_id: bigint;
  status: string;
  total_amount: Prisma.Decimal;
  created_at: Date;

  order_items: Array<{
    order_item_id: bigint;
    order_id: bigint;
    product_id: bigint;
    quantity: number;
    unit_price: Prisma.Decimal;
  }>;
};

export function serializeOrder(order: OrderWithItems) {
  return {
    order_id: order.order_id.toString(),
    user_id: order.user_id.toString(),
    status: order.status,
    total_amount: order.total_amount.toString(),
    created_at: order.created_at,

    items: order.order_items.map(item => ({
      order_item_id: item.order_item_id.toString(),
      product_id: item.product_id.toString(),
      quantity: item.quantity,
      unit_price: item.unit_price.toString(),

      subtotal: item.unit_price
        .mul(item.quantity)
        .toString(),
    })),
  };
}
