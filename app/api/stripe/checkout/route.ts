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

interface ShippingInfo {
  method: "FOXPOST_LOCKER" | "MPL_HOME_DELIVERY";
  cost: number; // HUF
  pickupPointId?: string;
  pickupPointName?: string;
  pickupPointAddress?: string;
}

interface CheckoutRequestBody {
  items: CartItem[];
  customer: CustomerInfo;
  shipping: ShippingInfo;
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

  if (!parsed.customer || !parsed.gdprConsent || !parsed.shipping) {
    return NextResponse.json(
      { error: "Hiányzó adatok." },
      { status: 400 },
    );
  }

  const { items, customer, shipping, gdprConsent } = parsed as CheckoutRequestBody;

  // Validate shipping cost against server-side config to prevent tampering.
  const { SHIPPING_PRICES } = await import("@/lib/shipping/config");
  const expectedShippingCost = SHIPPING_PRICES[shipping.method];
  if (!expectedShippingCost || shipping.cost !== expectedShippingCost) {
    return NextResponse.json({ error: "Érvénytelen szállítási díj." }, { status: 400 });
  }
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

    // Add a separate print fee line item if the item was created in the designer.
    // Validate: must be a positive multiple of 500 and within a reasonable upper bound.
    if (item.printFee && item.printFee > 0) {
      const maxAllowed = item.quantity * 100 * 3500; // very generous cap
      if (item.printFee % 500 !== 0 || item.printFee > maxAllowed) {
        return NextResponse.json(
          { error: "Érvénytelen nyomtatási díj." },
          { status: 400 },
        );
      }
      lineItems.push({
        price_data: {
          currency: "huf",
          product_data: { name: "Egyedi nyomtatás" },
          unit_amount: item.printFee * 100,
        },
        quantity: item.quantity,
      });
    }

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

  // Add shipping as a separate line item.
  const { SHIPPING_LABELS } = await import("@/lib/shipping/config");
  lineItems.push({
    price_data: {
      currency: "huf",
      product_data: { name: SHIPPING_LABELS[shipping.method] },
      unit_amount: shipping.cost * 100,
    },
    quantity: 1,
  });

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
      cartItems: JSON.stringify(cartItemsMeta),
      shippingMethod: shipping.method,
      shippingCost: String(shipping.cost),
      ...(shipping.pickupPointId ? { pickupPointId: shipping.pickupPointId } : {}),
      ...(shipping.pickupPointName ? { pickupPointName: shipping.pickupPointName } : {}),
      ...(shipping.pickupPointAddress ? { pickupPointAddress: shipping.pickupPointAddress } : {}),
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
