import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the service so the service picks up the mock.
vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { createOrder, updateOrderStatus } from "@/lib/services/order";
import type { OrderStatus } from "@/lib/generated/prisma/client";

const mockPrisma = prisma as unknown as {
  order: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const baseInput = {
  stripeSessionId: "cs_test_123",
  variantId: "variant_abc",
  productName: "Egyedi bögre",
  colorName: "Fehér",
  sizeName: "330ml",
  customerName: "Teszt Elek",
  customerEmail: "teszt@example.com",
  shippingAddress: {
    address: "Fő utca 1",
    city: "Budapest",
    postalCode: "1011",
    country: "HU",
  },
  totalAmount: 4990,
  gdprConsent: true,
  shippingMethod: "MPL_HOME_DELIVERY" as const,
  shippingCost: 1490,
};

describe("createOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an order when none exists for the session", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);
    mockPrisma.order.create.mockResolvedValue({ id: "order_1", ...baseInput, status: "PAID" });

    const result = await createOrder(baseInput);

    expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
      where: { stripeSessionId: baseInput.stripeSessionId },
    });
    expect(mockPrisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeSessionId: baseInput.stripeSessionId,
        status: "PAID",
        variantId: baseInput.variantId,
        customerEmail: baseInput.customerEmail,
        totalAmount: baseInput.totalAmount,
        gdprConsent: true,
      }),
    });
    expect(result).toMatchObject({ status: "PAID" });
  });

  it("is idempotent — returns existing order without creating a duplicate", async () => {
    const existing = { id: "order_existing", status: "PAID" };
    mockPrisma.order.findUnique.mockResolvedValue(existing);

    const result = await createOrder(baseInput);

    expect(mockPrisma.order.create).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });
});

describe("updateOrderStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions from PAID to IN_PRODUCTION", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: "order_1", status: "PAID" as OrderStatus });
    mockPrisma.order.update.mockResolvedValue({ id: "order_1", status: "IN_PRODUCTION" as OrderStatus });

    const result = await updateOrderStatus("order_1", "IN_PRODUCTION");

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { status: "IN_PRODUCTION" },
    });
    expect(result).toMatchObject({ status: "IN_PRODUCTION" });
  });

  it("throws for invalid status transitions", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: "order_1", status: "COMPLETE" as OrderStatus });

    await expect(updateOrderStatus("order_1", "PAID")).rejects.toThrow(
      "Invalid status transition: COMPLETE → PAID",
    );
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it("throws when the order does not exist", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    await expect(updateOrderStatus("nonexistent", "PAID")).rejects.toThrow(
      "Order not found: nonexistent",
    );
  });

  it("allows PAID → CANCELLED", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: "order_1", status: "PAID" as OrderStatus });
    mockPrisma.order.update.mockResolvedValue({ id: "order_1", status: "CANCELLED" as OrderStatus });

    await updateOrderStatus("order_1", "CANCELLED");

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { status: "CANCELLED" },
    });
  });
});
