import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createOrder, getOrderBySessionId } from "@/lib/services/order";
import { exportDesignSvg } from "@/lib/services/design";
import { sendOrderConfirmationEmail } from "@/lib/services/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});


export async function POST(req: NextRequest): Promise<NextResponse> {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
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

  const cartItems = parseCartItems(meta.cartItems);
  if (cartItems.length === 0) {
    console.error(`[webhook] No cart items in session ${session.id}`);
    return NextResponse.json({ error: "No cart items" }, { status: 400 });
  }

  // The current schema supports one item per order (cart enforces single-product in v1).
  const firstItem = cartItems[0];

  let shippingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };

  try {
    shippingAddress = JSON.parse(meta.shippingAddress ?? "{}");
  } catch {
    console.error(`[webhook] Invalid shippingAddress JSON in session ${session.id}`);
    return NextResponse.json({ error: "Invalid shippingAddress" }, { status: 400 });
  }

  // amount_total is in fillér (smallest unit) — convert back to whole HUF for storage.
  const totalAmount = Math.round((session.amount_total ?? 0) / 100);

  const shippingMethod =
    meta.shippingMethod === "FOXPOST_LOCKER" ? "FOXPOST_LOCKER" : "MPL_HOME_DELIVERY";
  const shippingCost = parseInt(meta.shippingCost ?? "0", 10);

  try {
    await createOrder({
      stripeSessionId: session.id,
      // Source-specific identifiers:
      ...(firstItem.source === "local"
        ? { variantId: firstItem.variantId }
        : {
            productSizeCode: firstItem.productSizeCode,
            productCode: firstItem.productCode,
          }),
      // Denormalized display fields — passed from metadata, not re-fetched.
      // Guarantees 8-year retention even if the product is later removed or renamed.
      productName: firstItem.productName,
      colorName: firstItem.colorName,
      sizeName: firstItem.sizeName,
      designId: firstItem.designId,
      customerName: meta.customerName ?? "",
      customerEmail: session.customer_email ?? "",
      shippingAddress,
      totalAmount,
      gdprConsent: meta.gdprConsent === "true",
      shippingMethod,
      shippingCost,
      ...(meta.pickupPointId ? { pickupPointId: meta.pickupPointId } : {}),
      ...(meta.pickupPointName ? { pickupPointName: meta.pickupPointName } : {}),
      ...(meta.pickupPointAddress ? { pickupPointAddress: meta.pickupPointAddress } : {}),
    });
  } catch (err) {
    console.error("[webhook] createOrder failed:", err);
    return NextResponse.json(
      { error: "Order creation failed" },
      { status: 500 },
    );
  }

  // Export design SVG to Supabase Storage — errors are logged but do not fail the webhook.
  if (firstItem.designId) {
    try {
      await exportDesignSvg(firstItem.designId);
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
        productName: fullOrder.productName,
        variantColor: fullOrder.colorName,
        variantSize: fullOrder.sizeName,
        totalAmount: fullOrder.totalAmount,
        shippingAddress,
        shippingMethod: fullOrder.shippingMethod,
        shippingCost: fullOrder.shippingCost,
        pickupPointName: fullOrder.pickupPointName ?? undefined,
        pickupPointAddress: fullOrder.pickupPointAddress ?? undefined,
      });
    }
  } catch (err) {
    console.error("[webhook] sendOrderConfirmationEmail failed:", err);
  }

  return NextResponse.json({ received: true });
}

// Shape embedded in Stripe session metadata by the checkout route.
interface CartItemMeta {
  source: "local" | "malfini";
  // Local only:
  variantId?: string;
  // Malfini only:
  productSizeCode?: string;
  productCode?: string;
  // Always set:
  productName: string;
  colorName: string;
  sizeName: string;
  quantity: number;
  designId?: string;
}

function parseCartItems(raw: string | undefined): CartItemMeta[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartItemMeta => {
      if (typeof item !== "object" || item === null) return false;
      const i = item as Record<string, unknown>;
      if (i.source !== "local" && i.source !== "malfini") return false;
      if (typeof i.productName !== "string") return false;
      if (typeof i.colorName !== "string") return false;
      if (typeof i.sizeName !== "string") return false;
      if (typeof i.quantity !== "number") return false;
      if (i.source === "local" && typeof i.variantId !== "string") return false;
      if (i.source === "malfini" && typeof i.productSizeCode !== "string") return false;
      return true;
    });
  } catch {
    return [];
  }
}
