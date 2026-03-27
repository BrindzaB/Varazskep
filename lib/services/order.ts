import { prisma } from "@/lib/db";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export interface CreateOrderInput {
  stripeSessionId: string;
  variantId: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  totalAmount: number; // HUF integer
  gdprConsent: boolean;
}

/**
 * Creates an order in the database after Stripe payment confirmation.
 * Must only ever be called from the Stripe webhook handler.
 *
 * Returns the created order, or null if an order for this session already
 * exists (idempotent — Stripe may deliver the same webhook more than once).
 */
export async function createOrder(input: CreateOrderInput) {
  const existing = await prisma.order.findUnique({
    where: { stripeSessionId: input.stripeSessionId },
  });

  if (existing) {
    return existing;
  }

  return prisma.order.create({
    data: {
      stripeSessionId: input.stripeSessionId,
      status: "PAID",
      variantId: input.variantId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      shippingAddress: input.shippingAddress,
      totalAmount: input.totalAmount,
      gdprConsent: input.gdprConsent,
    },
  });
}

/**
 * Transitions an order to a new status.
 * Enforces the allowed status progression defined by the business rules.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Order not found: ${orderId}`);

  const allowed = allowedTransitions[order.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${order.status} → ${newStatus}`,
    );
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus },
  });
}

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETE"],
  COMPLETE: [],
  CANCELLED: [],
};
