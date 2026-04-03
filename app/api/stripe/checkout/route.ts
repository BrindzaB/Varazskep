import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getRecommendedPrices, buildPriceMap } from "@/lib/malfini/client";
import { convertEurToHuf } from "@/lib/malfini/pricing";
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

// Shape embedded in Stripe session metadata (cartItems field).
// Webhook reads this to reconstruct the order.
interface CartItemMeta {
  source: "local" | "malfini";
  // Local only:
  variantId?: string;
  // Malfini only:
  productSizeCode?: string;
  productCode?: string;
  // Always set — denormalized for 8-year retention:
  productName: string;
  colorName: string;
  sizeName: string;
  quantity: number;
  designId?: string;
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

  // Fetch Malfini prices in one batch call before iterating items.
  // Pass 3-char product codes — the API filters by product code, not nomenclature code.
  // The response is keyed by productSizeCode (7-char), which we use for the per-item lookup.
  const malfiniProductCodes = items
    .filter((i) => i.source === "malfini")
    .map((i) => i.productCode)
    .filter((c): c is string => !!c);

  let malfiniPriceMap: Record<string, number> = {};
  if (malfiniProductCodes.length > 0) {
    const prices = await getRecommendedPrices(malfiniProductCodes);
    malfiniPriceMap = buildPriceMap(prices, convertEurToHuf);
  }

  // Build Stripe line items with authoritative prices and the metadata payload.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const cartItemsMeta: CartItemMeta[] = [];

  for (const item of items) {
    let unitPriceHuf: number;

    if (item.source === "local") {
      if (!item.variantId) {
        return NextResponse.json(
          { error: "Hiányzó variáns azonosító." },
          { status: 400 },
        );
      }
      // Look up the variant price from the DB — do not trust the client-provided price.
      const variant = await prisma.variant.findUnique({
        where: { id: item.variantId },
        select: { price: true },
      });
      if (!variant) {
        return NextResponse.json(
          { error: "A termék változat nem található." },
          { status: 400 },
        );
      }
      unitPriceHuf = variant.price;
    } else {
      // source === "malfini"
      if (!item.productSizeCode) {
        return NextResponse.json(
          { error: "Hiányzó termék méretkód." },
          { status: 400 },
        );
      }
      unitPriceHuf = malfiniPriceMap[item.productSizeCode] ?? 0;
      if (unitPriceHuf === 0) {
        return NextResponse.json(
          { error: "Nem sikerült lekérni a termék árát." },
          { status: 400 },
        );
      }
    }

    lineItems.push({
      price_data: {
        currency: "huf",
        product_data: { name: item.productName },
        // Stripe expects fillér (smallest unit): 100 fillér = 1 HUF.
        unit_amount: unitPriceHuf * 100,
      },
      quantity: item.quantity,
    });

    const meta: CartItemMeta = {
      source: item.source,
      productName: item.productName,
      colorName: item.colorName,
      sizeName: item.sizeName,
      quantity: item.quantity,
      ...(item.designId ? { designId: item.designId } : {}),
    };
    if (item.source === "local") {
      meta.variantId = item.variantId;
    } else {
      meta.productSizeCode = item.productSizeCode;
      meta.productCode = item.productCode;
    }
    cartItemsMeta.push(meta);
  }

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
      // cartItems carries source, IDs, and denormalized display fields.
      // Webhook reads this to create the Order — no re-fetching needed.
      cartItems: JSON.stringify(cartItemsMeta),
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
