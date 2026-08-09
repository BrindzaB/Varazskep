import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

// Mock the order service — the webhook's main side effects.
vi.mock("@/lib/services/order", () => ({
  applyShipmentStatus: vi.fn(),
  getOrderByKvikkTrackingNumber: vi.fn(),
}));

// Mock the email service — avoids importing the React Email templates + Resend.
vi.mock("@/lib/services/email", () => ({
  sendShipmentNotificationEmail: vi.fn(),
  sendPickupReadyEmail: vi.fn(),
}));

import { POST } from "@/app/api/kvikk/webhook/route";
import * as orderService from "@/lib/services/order";
import * as emailService from "@/lib/services/email";

const mockApply = vi.mocked(orderService.applyShipmentStatus);
const mockGetOrder = vi.mocked(orderService.getOrderByKvikkTrackingNumber);
const mockShipmentEmail = vi.mocked(emailService.sendShipmentNotificationEmail);
const mockPickupEmail = vi.mocked(emailService.sendPickupReadyEmail);
const SECRET = "test-webhook-secret";

type OrderRow = Awaited<
  ReturnType<typeof orderService.getOrderByKvikkTrackingNumber>
>;

// Builds just the order fields the webhook reads, cast to the real return type.
function orderRow(overrides: {
  deliveryType: "HOME_DELIVERY" | "DELIVERY_POINT";
  pickupPointName?: string | null;
  pickupPointAddress?: string | null;
}): OrderRow {
  return {
    deliveryType: overrides.deliveryType,
    pickupPointName: overrides.pickupPointName ?? null,
    pickupPointAddress: overrides.pickupPointAddress ?? null,
  } as unknown as OrderRow;
}

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

function makeRequest(body: string, sig?: string): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (sig !== undefined) headers["kvikk-webhook-signature"] = sig;
  return new NextRequest("http://localhost/api/kvikk/webhook", {
    method: "POST",
    headers,
    body,
  });
}

function payload(
  trackingNumber: string,
  flags: {
    shipped?: boolean;
    delivered?: boolean;
    returned?: boolean;
    readyForPickup?: boolean;
  }
): string {
  return JSON.stringify({
    trackingNumber,
    name: "Teszt Elek",
    email: "teszt@example.com",
    courier: "packeta",
    trackingLink: `https://tracking.kvikk.hu/#/${trackingNumber}`,
    tracking: {
      shipped: !!flags.shipped,
      delivered: !!flags.delivered,
      returned: !!flags.returned,
      updated: "2026-07-21T10:00:00.000Z",
      events: flags.readyForPickup ? [{ event: "ready_for_pickup" }] : [],
    },
  });
}

describe("POST /api/kvikk/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KVIKK_WEBHOOK_SECRET = SECRET;
    // Default: a home-delivery order exists for the tracking number.
    mockGetOrder.mockResolvedValue(orderRow({ deliveryType: "HOME_DELIVERY" }));
  });

  it("returns 400 when the signature header is missing", async () => {
    const body = payload("M000000000001", { shipped: true });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("returns 401 when the signature is invalid", async () => {
    const body = payload("M000000000001", { shipped: true });
    const res = await POST(makeRequest(body, "deadbeef"));
    expect(res.status).toBe(401);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("advances to SHIPPED on a shipped event (home delivery)", async () => {
    const body = payload("M000000000001", { shipped: true });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith("M000000000001", "SHIPPED");
  });

  it("advances to COMPLETE on a delivered event", async () => {
    const body = payload("M000000000002", { shipped: true, delivered: true });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith("M000000000002", "COMPLETE");
  });

  it("sets RETURNED on a returned event", async () => {
    const body = payload("M000000000003", { returned: true });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith("M000000000003", "RETURNED");
  });

  it("acknowledges (200) without updating when no status flags are set", async () => {
    const body = payload("M000000000004", {});
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("acknowledges (200) without updating when the tracking number is unknown", async () => {
    mockGetOrder.mockResolvedValue(null);
    const body = payload("M000000000099", { shipped: true });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("sends the 'on its way' email once when a home order first reaches SHIPPED", async () => {
    mockApply.mockResolvedValue(true);
    const body = payload("M000000000005", { shipped: true });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith("M000000000005", "SHIPPED");
    expect(mockShipmentEmail).toHaveBeenCalledTimes(1);
    expect(mockPickupEmail).not.toHaveBeenCalled();
  });

  it("advances a pickup order to SHIPPED on ready_for_pickup and sends the pickup email", async () => {
    mockGetOrder.mockResolvedValue(
      orderRow({
        deliveryType: "DELIVERY_POINT",
        pickupPointName: "Packeta pont – Tesco",
        pickupPointAddress: "1234 Budapest, Fő út 1.",
      })
    );
    mockApply.mockResolvedValue(true);
    const body = payload("M000000000006", { readyForPickup: true });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith("M000000000006", "SHIPPED");
    expect(mockPickupEmail).toHaveBeenCalledTimes(1);
    expect(mockPickupEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: "teszt@example.com",
        pointName: "Packeta pont – Tesco",
        pointAddress: "1234 Budapest, Fő út 1.",
      })
    );
    expect(mockShipmentEmail).not.toHaveBeenCalled();
  });

  it("ignores a bare shipped event for a pickup order (waits for ready_for_pickup)", async () => {
    mockGetOrder.mockResolvedValue(
      orderRow({ deliveryType: "DELIVERY_POINT" })
    );
    const body = payload("M000000000007", { shipped: true });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(mockApply).not.toHaveBeenCalled();
    expect(mockPickupEmail).not.toHaveBeenCalled();
  });

  it("completes a pickup order on delivered without re-sending the pickup email", async () => {
    mockGetOrder.mockResolvedValue(
      orderRow({ deliveryType: "DELIVERY_POINT" })
    );
    mockApply.mockResolvedValue(true);
    const body = payload("M000000000008", {
      readyForPickup: true,
      delivered: true,
    });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith("M000000000008", "COMPLETE");
    expect(mockPickupEmail).not.toHaveBeenCalled();
  });
});
