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
  items: [
    {
      variantId: "variant_abc",
      productName: "Egyedi bögre",
      colorName: "Fehér",
      sizeName: "330ml",
      quantity: 2,
      unitPriceHuf: 3490,
      printFeeHuf: 3000,
      designId: "design_1",
    },
    {
      productSizeCode: "1290012",
      productCode: "129",
      productName: "Heavy póló",
      colorName: "Fekete",
      sizeName: "M",
      quantity: 5,
      unitPriceHuf: 2990,
      printFeeHuf: 0,
    },
  ],
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
  shippingCost: 1490,
  shippingCourier: "mpl",
  deliveryType: "HOME_DELIVERY" as const,
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
        customerEmail: baseInput.customerEmail,
        totalAmount: baseInput.totalAmount,
        gdprConsent: true,
      }),
    });
    expect(result).toMatchObject({ status: "PAID" });
  });

  it("stores every cart line with its quantity and prices, in cart order", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);
    mockPrisma.order.create.mockResolvedValue({ id: "order_1" });

    await createOrder(baseInput);

    const { data } = mockPrisma.order.create.mock.calls[0][0];
    expect(data.items.create).toEqual([
      {
        position: 0,
        variantId: "variant_abc",
        productName: "Egyedi bögre",
        colorName: "Fehér",
        sizeName: "330ml",
        quantity: 2,
        unitPriceHuf: 3490,
        printFeeHuf: 3000,
        designId: "design_1",
      },
      {
        position: 1,
        productSizeCode: "1290012",
        productCode: "129",
        productName: "Heavy póló",
        colorName: "Fekete",
        sizeName: "M",
        quantity: 5,
        unitPriceHuf: 2990,
        printFeeHuf: 0,
      },
    ]);
    // The legacy single-item columns are no longer written.
    expect(data).not.toHaveProperty("variantId");
    expect(data).not.toHaveProperty("productName");
    expect(data).not.toHaveProperty("designId");
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
