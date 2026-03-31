import { prisma } from "@/lib/db";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export interface CreateOrderInput {
  stripeSessionId: string;
  variantId: string;
  designId?: string; // links the pre-created Design record to this order
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
 * Fetches an order by its Stripe session ID, including variant + product info.
 * Used by the confirmation page.
 */
export async function getOrderBySessionId(stripeSessionId: string) {
  return prisma.order.findUnique({
    where: { stripeSessionId },
    include: {
      variant: {
        include: { product: true },
      },
    },
  });
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
      ...(input.designId ? { designId: input.designId } : {}),
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

/**
 * Returns all orders sorted by creation date descending, with variant + product info.
 * Used by the admin order list.
 */
export async function getAllOrders() {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      variant: { include: { product: true } },
    },
  });
}

/**
 * Returns a single order with full relations including design.
 * Used by the admin order detail page.
 */
export async function getOrderById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      variant: { include: { product: true } },
      design: true,
    },
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

// Sentinel value written to string PII fields after erasure.
export const PII_ERASED_SENTINEL = "[törölve]";

/**
 * Nulls all personal data fields on an order (GDPR Art. 17 erasure).
 * The order row itself is retained to satisfy Hungarian tax law (8-year retention).
 * Safe to call multiple times — subsequent calls are no-ops on already-erased orders.
 */
export async function eraseOrderPii(orderId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      customerName: PII_ERASED_SENTINEL,
      customerEmail: PII_ERASED_SENTINEL,
      shippingAddress: {},
    },
  });
}
