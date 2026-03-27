import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import type { CartItem } from "@/lib/cart/cartStore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  shippingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

interface CheckoutRequestBody {
  items: CartItem[];
  customer: CustomerInfo;
  gdprConsent: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = body as Partial<CheckoutRequestBody>;

  if (
    !parsed.items ||
    !Array.isArray(parsed.items) ||
    parsed.items.length === 0
  ) {
    return NextResponse.json(
      { error: "A kosár üres." },
      { status: 400 },
    );
  }

  if (!parsed.customer || !parsed.gdprConsent) {
    return NextResponse.json(
      { error: "Hiányzó adatok." },
      { status: 400 },
    );
  }

  const { items, customer, gdprConsent } = parsed as CheckoutRequestBody;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
    (item) => ({
      price_data: {
        currency: "huf",
        product_data: {
          name: item.productName,
          metadata: {
            variantId: item.variantId,
            color: item.color,
            size: item.size,
          },
        },
        // Stripe expects the smallest currency unit.
        // HUF is a zero-decimal currency — amount is passed as-is.
        unit_amount: item.price,
      },
      quantity: item.quantity,
    }),
  );

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    customer_email: customer.email,
    shipping_address_collection: {
      allowed_countries: ["HU"],
    },
    metadata: {
      customerName: customer.name,
      customerPhone: customer.phone,
      shippingAddress: JSON.stringify(customer.shippingAddress),
      gdprConsent: String(gdprConsent),
      // Pass cart as metadata so the webhook can reconstruct the order.
      // Each item includes variantId and quantity; price comes from the
      // Stripe line items to prevent client-side price tampering.
      cartItems: JSON.stringify(
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      ),
    },
    success_url: `${appUrl}/order/{CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Nem sikerült létrehozni a fizetési munkamenetet." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
