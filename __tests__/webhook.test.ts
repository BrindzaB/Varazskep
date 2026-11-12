import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// vi.hoisted ensures these are available inside vi.mock factory (which is hoisted).
const { mockConstructEvent } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
}));

// Mock Stripe before importing the route so the module picks up the mock.
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      webhooks = { constructEvent: mockConstructEvent };
    },
  };
});

// Mock the order service.
vi.mock("@/lib/services/order", () => ({
  createOrder: vi.fn(),
  getOrderBySessionId: vi.fn(),
}));

// Mock the email service — prevents the React Email template (JSX) from being
// imported and keeps tests focused on the webhook handler logic.
vi.mock("@/lib/services/email", () => ({
  sendOrderConfirmationEmail: vi.fn(),
  sendOrderNotificationEmail: vi.fn(),
}));

// Mock the design service — exportDesignSvg requires DB + Supabase env vars.
vi.mock("@/lib/services/design", () => ({
  exportDesignSvg: vi.fn(),
}));

// Mock Supabase — required by the design service module at import time.
vi.mock("@/lib/supabase", () => ({
  createSupabaseAdmin: vi.fn(),
  BUCKET_DESIGNS: "designs",
}));

import { POST } from "@/app/api/stripe/webhook/route";
import * as orderService from "@/lib/services/order";
import * as designService from "@/lib/services/design";
import * as emailService from "@/lib/services/email";

const mockCreateOrder = vi.mocked(orderService.createOrder);
const mockGetOrderBySessionId = vi.mocked(orderService.getOrderBySessionId);
const mockConfirmationEmail = vi.mocked(emailService.sendOrderConfirmationEmail);
const mockNotificationEmail = vi.mocked(emailService.sendOrderNotificationEmail);

function makeRequest(body: string, sig = "valid-sig"): NextRequest {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": sig,
    },
    body,
  });
}

const mugLine = {
  source: "local",
  variantId: "variant_abc",
  productName: "Egyedi bögre",
  colorName: "Fehér",
  sizeName: "330ml",
  quantity: 1,
  unitPriceHuf: 3500,
  printFeeHuf: 0,
};

const shirtLine = {
  source: "malfini",
  productSizeCode: "1290012",
  productCode: "129",
  productName: "Heavy póló",
  colorName: "Fekete",
  sizeName: "M",
  quantity: 4,
  unitPriceHuf: 2990,
  printFeeHuf: 3000,
  designId: "design_1",
};

const billing = {
  type: "COMPANY",
  name: "Teszt Kft.",
  taxNumber: "12345678-2-41",
  address: {
    address: "Váci út 10",
    city: "Budapest",
    postalCode: "1132",
    country: "HU",
  },
};

function makeSession(overrides: Record<string, unknown> = {}): object {
  return {
    id: "cs_test_123",
    payment_status: "paid",
    amount_total: 499000, // 4990 HUF in fillér (Stripe smallest unit)
    customer_email: "teszt@example.com",
    metadata: {
      customerName: "Teszt Elek",
      customerPhone: "+36301234567",
      shippingAddress: JSON.stringify({
        address: "Fő utca 1",
        city: "Budapest",
        postalCode: "1011",
        country: "HU",
      }),
      billing: JSON.stringify(billing),
      gdprConsent: "true",
      itemCount: "1",
      item_0: JSON.stringify(mugLine),
      shippingCourier: "mpl",
      deliveryType: "HOME_DELIVERY",
      shippingCost: "1490",
      shippingWeightGrams: "1000",
    },
    ...overrides,
  };
}

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/missing stripe-signature/i);
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/signature verification failed/i);
  });

  it("returns 200 and does nothing for non-checkout events", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.created",
      data: { object: {} },
    });
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("returns 200 and does nothing when payment_status is not paid", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: makeSession({ payment_status: "unpaid" }) },
    });
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("calls createOrder with correct data for a valid paid session", async () => {
    const session = makeSession();
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });
    mockCreateOrder.mockResolvedValue({ id: "order_1" } as never);

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockCreateOrder).toHaveBeenCalledWith({
      stripeSessionId: "cs_test_123",
      items: [
        {
          variantId: "variant_abc",
          productName: "Egyedi bögre",
          colorName: "Fehér",
          sizeName: "330ml",
          quantity: 1,
          unitPriceHuf: 3500,
          printFeeHuf: 0,
          designId: undefined,
        },
      ],
      customerName: "Teszt Elek",
      customerEmail: "teszt@example.com",
      customerPhone: "+36301234567",
      shippingAddress: {
        address: "Fő utca 1",
        city: "Budapest",
        postalCode: "1011",
        country: "HU",
      },
      billing,
      totalAmount: 4990,
      gdprConsent: true,
      shippingCost: 1490,
      shippingCourier: "mpl",
      deliveryType: "HOME_DELIVERY",
      parcelWeightGrams: 1000,
    });
  });

  it("stores every cart line, not just the first", async () => {
    const base = makeSession() as { metadata: Record<string, string> };
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: makeSession({
          metadata: {
            ...base.metadata,
            itemCount: "2",
            item_1: JSON.stringify(shirtLine),
          },
        }),
      },
    });
    mockCreateOrder.mockResolvedValue({ id: "order_1" } as never);

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    const input = mockCreateOrder.mock.calls[0][0];
    expect(input.items).toHaveLength(2);
    expect(input.items[1]).toEqual({
      productSizeCode: "1290012",
      productCode: "129",
      productName: "Heavy póló",
      colorName: "Fekete",
      sizeName: "M",
      quantity: 4,
      unitPriceHuf: 2990,
      printFeeHuf: 3000,
      designId: "design_1",
    });
    expect(vi.mocked(designService.exportDesignSvg)).toHaveBeenCalledWith(
      "design_1"
    );
  });

  it("returns 400 instead of storing a partial order when a line is missing", async () => {
    const base = makeSession() as { metadata: Record<string, string> };
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: makeSession({ metadata: { ...base.metadata, itemCount: "2" } }),
      },
    });
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(400);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("returns 400 when cartItems metadata is missing", async () => {
    const session = makeSession({
      metadata: {
        customerName: "Teszt Elek",
        shippingAddress: JSON.stringify({
          address: "Fő utca 1",
          city: "Budapest",
          postalCode: "1011",
          country: "HU",
        }),
        gdprConsent: "true",
        // cartItems intentionally omitted
      },
    });
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(400);
  });

  it("returns 400 without creating an order when billing metadata is missing", async () => {
    const base = makeSession() as { metadata: Record<string, string> };
    const { billing: _omitted, ...metadata } = base.metadata;
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: makeSession({ metadata }) },
    });
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(400);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("returns 500 when createOrder throws", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: makeSession() },
    });
    mockCreateOrder.mockRejectedValue(new Error("DB connection failed"));

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(500);
  });

  it("emails both the customer and the shop, even if one email fails", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: makeSession() },
    });
    mockCreateOrder.mockResolvedValue({ id: "order_1" } as never);
    mockGetOrderBySessionId.mockResolvedValue({
      id: "order_1",
      customerName: "Teszt Elek",
      customerEmail: "teszt@example.com",
      customerPhone: "+36301234567",
      items: [],
      shippingCost: 1490,
      shippingCourier: "mpl",
      deliveryType: "HOME_DELIVERY",
      shippingMethod: "MPL_HOME_DELIVERY",
      pickupPointName: null,
      pickupPointAddress: null,
    } as never);
    mockConfirmationEmail.mockRejectedValue(new Error("Resend down"));

    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(mockNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order_1",
        customerPhone: "+36301234567",
        totalAmount: 4990,
      })
    );
  });
});
