import { NextRequest, NextResponse } from "next/server";
import type { CartItem } from "@/lib/cart/cartStore";
import { resolveParcelWeightGrams } from "@/lib/services/shipping";
import { getShippingQuote } from "@/lib/kvikk/pricing";
import { toDeliveryPointType } from "@/lib/kvikk/deliveryPointMap";
import {
  HOME_DELIVERY_OPTIONS,
  POINT_DELIVERY_OPTIONS,
} from "@/lib/kvikk/deliveryOptions";

// Live pricing — never cache the response at the route level.
export const dynamic = "force-dynamic";

interface QuoteRequestBody {
  items: CartItem[];
}

interface HomeQuote {
  courier: string;
  label: string;
  grossHuf: number;
}

interface PointQuote {
  courier: string;
  mapType: string;
  deliveryPointType: string;
  label: string;
  grossHuf: number;
}

// Computes the shipping options + prices for the current cart. Parcel weight is resolved
// SERVER-SIDE from the product data (never trusting the client), summed across the cart as
// a single parcel (the cart is single-product in v1), then priced per offered option.
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = (body as Partial<QuoteRequestBody>)?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "A kosár üres." }, { status: 400 });
  }

  // Resolve total parcel weight (grams) server-side.
  let totalWeightGrams = 0;
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return NextResponse.json(
        { error: "Érvénytelen mennyiség." },
        { status: 400 }
      );
    }
    let unitWeight: number;
    if (item.source === "local") {
      if (!item.variantId) {
        return NextResponse.json(
          { error: "Hiányzó variáns azonosító." },
          { status: 400 }
        );
      }
      unitWeight = await resolveParcelWeightGrams({
        source: "local",
        variantId: item.variantId,
      });
    } else if (item.source === "malfini") {
      if (!item.productCode || !item.productSizeCode) {
        return NextResponse.json(
          { error: "Hiányzó termékkód." },
          { status: 400 }
        );
      }
      unitWeight = await resolveParcelWeightGrams({
        source: "malfini",
        productCode: item.productCode,
        productSizeCode: item.productSizeCode,
      });
    } else {
      return NextResponse.json(
        { error: "Ismeretlen terméktípus." },
        { status: 400 }
      );
    }
    totalWeightGrams += unitWeight * item.quantity;
  }

  // Price each offered option. Options the courier can't handle for this weight are omitted.
  try {
    const home: HomeQuote[] = [];
    for (const opt of HOME_DELIVERY_OPTIONS) {
      const quote = await getShippingQuote({
        courier: opt.courier,
        weightGrams: totalWeightGrams,
      });
      if (quote) {
        home.push({
          courier: opt.courier,
          label: opt.label,
          grossHuf: quote.grossHuf,
        });
      }
    }

    const points: PointQuote[] = [];
    for (const opt of POINT_DELIVERY_OPTIONS) {
      const deliveryPointType = toDeliveryPointType(opt.courier, opt.mapType);
      if (!deliveryPointType) continue;
      const quote = await getShippingQuote({
        courier: opt.courier,
        deliveryPointType,
        weightGrams: totalWeightGrams,
      });
      if (quote) {
        points.push({
          courier: opt.courier,
          mapType: opt.mapType,
          deliveryPointType,
          label: opt.label,
          grossHuf: quote.grossHuf,
        });
      }
    }

    return NextResponse.json({ totalWeightGrams, home, points });
  } catch (err) {
    console.error("[shipping/quote] pricing failed:", err);
    return NextResponse.json(
      {
        error:
          "Nem sikerült lekérni a szállítási díjakat. Kérjük, próbálja újra.",
      },
      { status: 502 }
    );
  }
}
