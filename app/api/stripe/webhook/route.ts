import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createOrder, getOrderBySessionId } from "@/lib/services/order";
import { exportDesignSvg } from "@/lib/services/design";
import { sendOrderConfirmationEmail } from "@/lib/services/email";
import type { DeliveryType } from "@/lib/generated/prisma/client";
import { decodeCartItems } from "@/lib/checkout/cartMetadata";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  if (event.type !== "checkout.session.completed") {
    // Acknowledge events we don't handle — returning 200 prevents Stripe retries.
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Guard: only process sessions that were actually paid.
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const meta = session.metadata ?? {};

  const cartItems = decodeCartItems(meta);
  if (cartItems.length === 0) {
    console.error(`[webhook] No cart items in session ${session.id}`);
    return NextResponse.json({ error: "No cart items" }, { status: 400 });
  }

  let shippingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };

  try {
    shippingAddress = JSON.parse(meta.shippingAddress ?? "{}");
  } catch {
    console.error(
      `[webhook] Invalid shippingAddress JSON in session ${session.id}`
    );
    return NextResponse.json(
      { error: "Invalid shippingAddress" },
      { status: 400 }
    );
  }

  // amount_total is in fillér (smallest unit) — convert back to whole HUF for storage.
  const totalAmount = Math.round((session.amount_total ?? 0) / 100);

  const shippingCost = parseInt(meta.shippingCost ?? "0", 10);
  const deliveryType: DeliveryType =
    meta.deliveryType === "DELIVERY_POINT" ? "DELIVERY_POINT" : "HOME_DELIVERY";
  const shippingCourier = meta.shippingCourier ?? "";
  const parcelWeightGrams = meta.shippingWeightGrams
    ? parseInt(meta.shippingWeightGrams, 10)
    : undefined;

  try {
    await createOrder({
      stripeSessionId: session.id,
      // Display fields are passed from metadata, not re-fetched. Guarantees 8-year
      // retention even if the product is later removed or renamed.
      items: cartItems.map((item) => ({
        // Source-specific identifiers:
        ...(item.source === "local"
          ? { variantId: item.variantId }
          : {
              productSizeCode: item.productSizeCode,
              productCode: item.productCode,
            }),
        productName: item.productName,
        colorName: item.colorName,
        sizeName: item.sizeName,
        quantity: item.quantity,
        unitPriceHuf: item.unitPriceHuf,
        printFeeHuf: item.printFeeHuf,
        designId: item.designId,
      })),
      customerName: meta.customerName ?? "",
      customerEmail: session.customer_email ?? "",
      customerPhone: meta.customerPhone,
      shippingAddress,
      totalAmount,
      gdprConsent: meta.gdprConsent === "true",
      shippingCost,
      shippingCourier,
      deliveryType,
      parcelWeightGrams,
      ...(meta.deliveryPointType
        ? { deliveryPointType: meta.deliveryPointType }
        : {}),
      ...(meta.deliveryPointId
        ? { deliveryPointId: meta.deliveryPointId }
        : {}),
      ...(meta.pointName ? { pickupPointName: meta.pointName } : {}),
      ...(meta.pointAddress ? { pickupPointAddress: meta.pointAddress } : {}),
    });
  } catch (err) {
    console.error("[webhook] createOrder failed:", err);
    return NextResponse.json(
      { error: "Order creation failed" },
      { status: 500 }
    );
  }

  // Note: the Kvikk shipment + label is NOT created here. It is created manually from the
  // admin panel when the product is ready (step 8.9), then the courier is requested via a
  // delivery note. The webhook only persists the order + the customer's shipping choice.

  // Export each design's SVG to Supabase Storage — errors are logged but do not fail
  // the webhook.
  for (const item of cartItems) {
    if (!item.designId) continue;
    try {
      await exportDesignSvg(item.designId);
    } catch (err) {
      console.error("[webhook] exportDesignSvg failed:", err);
    }
  }

  // Send confirmation email — errors are logged but do not fail the webhook.
  // A failed email must not cause Stripe to retry (which would risk duplicate orders).
  try {
    const fullOrder = await getOrderBySessionId(session.id);
    if (fullOrder) {
      await sendOrderConfirmationEmail({
        orderId: fullOrder.id,
        customerName: fullOrder.customerName,
        customerEmail: fullOrder.customerEmail,
        items: fullOrder.items,
        totalAmount: fullOrder.totalAmount,
        shippingAddress,
        shippingCost: fullOrder.shippingCost,
        shippingCourier: fullOrder.shippingCourier,
        deliveryType: fullOrder.deliveryType,
        shippingMethod: fullOrder.shippingMethod,
        pickupPointName: fullOrder.pickupPointName,
        pickupPointAddress: fullOrder.pickupPointAddress,
      });
    }
  } catch (err) {
    console.error("[webhook] sendOrderConfirmationEmail failed:", err);
  }

  return NextResponse.json({ received: true });
}
