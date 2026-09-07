// Shipping price computation from the cached Kvikk account pricing.
// Single source of truth for the customer-facing shipping fee — used by both the checkout
// Map widget config and the server-side checkout validation, so the two can never diverge.
//
// Kvikk pricing is NET (VAT excluded); customer prices are gross. The VAT rate and the
// permitted price endings come from the admin pricing settings, the same ones that drive
// product prices, so shipping and products can never disagree about VAT.
//
// Pricing is keyed by a PRICE KEY + country: the bare courier slug for home delivery
// (e.g. "mpl"), or a deliveryPointType slug for a delivery point (e.g. "mpl_automata").
//
// Kvikk revises its price list monthly. Nothing here needs updating for that: the tables
// come live from GET /account-details (cached 1h in lib/kvikk/account.ts), so a new list
// takes effect within the hour with no deploy.

import { getCachedAccountDetails } from "./account";
import { roundToEndings } from "@/lib/pricing/compute";
import { getPricingSettings } from "@/lib/pricing/settings";
import type { KvikkCourier } from "./types";

export interface ShippingQuote {
  netHuf: number; // Kvikk net cost (our internal cost)
  grossHuf: number; // customer-facing price, incl. VAT, snapped to a permitted ending
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

  const [{ pricing }, settings] = await Promise.all([
    getCachedAccountDetails(),
    getPricingSettings(),
  ]);

  const table = pricing.shipping.find(
    (s) => s.courier === priceKey && s.country === country
  );
  if (!table) return null;

  const range = table.prices.find(
    (p) => params.weightGrams >= p.min && params.weightGrams <= p.max
  );
  if (!range) return null;

  const netHuf = range.cost;
  const withVat = netHuf * (1 + settings.vatPct / 100);

  // Rounded UP, unlike product prices. Kvikk's cost is fixed and our shipping markup is
  // zero, so the nearest permitted ending would often land below cost: measured over the
  // 80 weight bands we offer, rounding to the nearest …50/…90 put 52 of them under cost
  // (worst case −23 Ft per parcel). Rounding up costs the customer at most a few tens of
  // forints and never sells a shipment at a loss.
  const grossHuf = roundToEndings(withVat, settings.shippingPriceEndings, "up");

  return { netHuf, grossHuf };
}
