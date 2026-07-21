import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { applyShipmentStatus } from "@/lib/services/order";
import type { KvikkWebhookPayload } from "@/lib/kvikk/types";

// Kvikk pushes shipment status changes here. We verify the HMAC-SHA256 signature over the
// raw body, then advance the matching order's status from the authenticated payload.
// Supported events: dispatched / shipped / delivered / returned.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.KVIKK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[kvikk-webhook] KVIKK_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("kvikk-webhook-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const compBuf = Buffer.from(computed);
  if (sigBuf.length !== compBuf.length || !timingSafeEqual(sigBuf, compBuf)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: KvikkWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as KvikkWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const trackingNumber = payload.trackingNumber;
  const tracking = payload.tracking;
  if (!trackingNumber || !tracking) {
    return NextResponse.json({ received: true });
  }

  // Derive the target status from the authenticated payload (priority order).
  const target: "RETURNED" | "COMPLETE" | "SHIPPED" | null = tracking.returned
    ? "RETURNED"
    : tracking.delivered
      ? "COMPLETE"
      : tracking.shipped
        ? "SHIPPED"
        : null;
  if (!target) {
    return NextResponse.json({ received: true });
  }

  try {
    await applyShipmentStatus(trackingNumber, target);
  } catch (err) {
    console.error("[kvikk-webhook] applyShipmentStatus failed:", err);
  }
  return NextResponse.json({ received: true });
}
