// Shipping price computation from the cached Kvikk account pricing.
// Single source of truth for the customer-facing shipping fee — used by both the checkout
// Map widget config and the server-side checkout validation, so the two can never diverge.
//
// Kvikk pricing is NET (VAT excluded); customer prices are gross. We add Hungarian VAT.
// Pricing is keyed by a PRICE KEY + country: the bare courier slug for home delivery
// (e.g. "mpl"), or a deliveryPointType slug for a delivery point (e.g. "mpl_automata").

import { getCachedAccountDetails } from "./account";
import type { KvikkCourier } from "./types";

// Hungarian standard VAT rate (27%). Kvikk list prices are net of VAT.
export const VAT_RATE = 0.27;

export interface ShippingQuote {
  netHuf: number; // Kvikk net cost (our internal cost)
  grossHuf: number; // customer-facing price, incl. VAT, rounded to whole HUF
}

export interface ShippingQuoteParams {
  courier: KvikkCourier;
  deliveryPointType?: string; // set for delivery-point orders; omit for home delivery
  country?: string; // defaults to "HU"
  weightGrams: number;
}

// Computes the shipping quote, or null if no matching price table / weight range exists
// (e.g. unsupported courier+country combination, or weight above the courier's max).
// Never guesses a price — a null result must be surfaced as an error by the caller.
export async function getShippingQuote(
  params: ShippingQuoteParams
): Promise<ShippingQuote | null> {
  const country = params.country ?? "HU";
  const priceKey = params.deliveryPointType ?? params.courier;

  const { pricing } = await getCachedAccountDetails();

  const table = pricing.shipping.find(
    (s) => s.courier === priceKey && s.country === country
  );
  if (!table) return null;

  const range = table.prices.find(
    (p) => params.weightGrams >= p.min && params.weightGrams <= p.max
  );
  if (!range) return null;

  const netHuf = range.cost;
  const grossHuf = Math.round(netHuf * (1 + VAT_RATE));
  return { netHuf, grossHuf };
}
