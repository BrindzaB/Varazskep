import { prisma } from "@/lib/db";
import type { DeliveryType, OrderStatus } from "@/lib/generated/prisma/client";

export interface CreateOrderInput {
  stripeSessionId: string;
  // One of these must be set — never both.
  variantId?: string; // local products (mugs, etc.)
  productSizeCode?: string; // Malfini products — 7-char SKU
  productCode?: string; // Malfini products — 3-char product code
  // Denormalized display fields — always set regardless of source.
  // Required for 8-year retention even if the product is later removed.
  productName: string;
  colorName: string;
  sizeName: string;
  designId?: string; // links the pre-created Design record to this order
  customerName: string;
  customerEmail: string;
  shippingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  totalAmount: number; // HUF integer (includes shipping cost)
  gdprConsent: boolean;
  shippingCost: number; // HUF integer
  // Kvikk shipping
  shippingCourier: string; // Kvikk courier slug (mpl, gls, foxpost, ...)
  deliveryType: DeliveryType; // HOME_DELIVERY | DELIVERY_POINT
  deliveryPointType?: string; // set for delivery-point orders
  deliveryPointId?: string;
  parcelWeightGrams?: number; // captured at checkout — used when the shipment is created
  pickupPointName?: string; // point display name (delivery-point orders)
  pickupPointAddress?: string;
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
      // Source-specific identifiers — one or the other, never both.
      ...(input.variantId ? { variantId: input.variantId } : {}),
      ...(input.productSizeCode
        ? { productSizeCode: input.productSizeCode }
        : {}),
      ...(input.productCode ? { productCode: input.productCode } : {}),
      // Denormalized display fields — always written for both sources.
      productName: input.productName,
      colorName: input.colorName,
      sizeName: input.sizeName,
      ...(input.designId ? { designId: input.designId } : {}),
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      shippingAddress: input.shippingAddress,
      totalAmount: input.totalAmount,
      gdprConsent: input.gdprConsent,
      shippingCost: input.shippingCost,
      shippingCourier: input.shippingCourier,
      deliveryType: input.deliveryType,
      ...(input.deliveryPointType
        ? { deliveryPointType: input.deliveryPointType }
        : {}),
      ...(input.deliveryPointId
        ? { deliveryPointId: input.deliveryPointId }
        : {}),
      ...(input.parcelWeightGrams
        ? { parcelWeightGrams: input.parcelWeightGrams }
        : {}),
      ...(input.pickupPointName
        ? { pickupPointName: input.pickupPointName }
        : {}),
      ...(input.pickupPointAddress
        ? { pickupPointAddress: input.pickupPointAddress }
        : {}),
    },
  });
}

/**
 * Persists the Kvikk shipment identifiers on an order after the shipment is created.
 */
export async function setOrderShipment(
  orderId: string,
  data: {
    kvikkTrackingNumber: string;
    courierTrackingNumber: string;
    kvikkShipmentId?: string;
  }
) {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      kvikkTrackingNumber: data.kvikkTrackingNumber,
      courierTrackingNumber: data.courierTrackingNumber,
      ...(data.kvikkShipmentId
        ? { kvikkShipmentId: data.kvikkShipmentId }
        : {}),
    },
  });
}

/**
 * Transitions an order to a new status.
 * Enforces the allowed status progression defined by the business rules.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Order not found: ${orderId}`);

  const allowed = allowedTransitions[order.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${order.status} → ${newStatus}`
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
  SHIPPED: ["COMPLETE", "RETURNED"], // RETURNED set by the Kvikk webhook on a `returned` event
  COMPLETE: [],
  RETURNED: [],
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
