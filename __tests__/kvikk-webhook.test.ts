import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

// Mock the order service — the webhook's only side effect.
vi.mock("@/lib/services/order", () => ({
  applyShipmentStatus: vi.fn(),
}));

import { POST } from "@/app/api/kvikk/webhook/route";
import * as orderService from "@/lib/services/order";

const mockApply = vi.mocked(orderService.applyShipmentStatus);
const SECRET = "test-webhook-secret";

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
  flags: { shipped?: boolean; delivered?: boolean; returned?: boolean }
): string {
  return JSON.stringify({
    trackingNumber,
    tracking: {
      shipped: !!flags.shipped,
      delivered: !!flags.delivered,
      returned: !!flags.returned,
      updated: "2026-07-21T10:00:00.000Z",
      events: [],
    },
  });
}

describe("POST /api/kvikk/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KVIKK_WEBHOOK_SECRET = SECRET;
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

  it("advances to SHIPPED on a shipped event with a valid signature", async () => {
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
});
