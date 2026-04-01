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

  // The current schema supports one variant per order.
  // Phase 3 will extend this when the designer is added.
  // For now take the first item only (cart enforces single-product in v1).
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

  // amount_total is returned in fillér (smallest unit) — convert back to whole HUF for storage.
  const totalAmount = Math.round((session.amount_total ?? 0) / 100);

  try {
    await createOrder({
      stripeSessionId: session.id,
      variantId: firstItem.variantId,
      designId: firstItem.designId,
      customerName: meta.customerName ?? "",
      customerEmail: session.customer_email ?? "",
      shippingAddress,
      totalAmount,
      gdprConsent: meta.gdprConsent === "true",
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
    // Fetch the full order with variant + product to populate the email properly.
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
      });
    }
  } catch (err) {
    console.error("[webhook] sendOrderConfirmationEmail failed:", err);
  }

  return NextResponse.json({ received: true });
}

interface CartItemMeta {
  variantId: string;
  quantity: number;
  designId?: string;
}

function parseCartItems(raw: string | undefined): CartItemMeta[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItemMeta =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItemMeta).variantId === "string" &&
        typeof (item as CartItemMeta).quantity === "number",
    ).map((item) => ({
      ...item,
      // designId is optional — only present for designed items
      designId: typeof item.designId === "string" ? item.designId : undefined,
    }));
  } catch {
    return [];
  }
}
