// Admin-editable pricing parameters, backed by the PricingSetting key/value table.
//
// An empty table is a valid state: every getter falls back to PRICING_DEFAULTS, so
// the shop prices correctly before an admin ever opens the pricing screen. Values
// are stored as text and re-validated on read — a corrupt row degrades to the
// default rather than producing a nonsensical price.
//
// Deliberately uncached: the table holds a handful of rows behind a primary-key
// scan, and the storefront pages that read it are themselves ISR-cached. A module
// cache would only add staleness that admins would experience as "my price change
// did nothing", with no meaningful saving.

import { prisma } from "@/lib/db";
import { formatEndings, parseEndings } from "./compute";

// Re-exported for convenience: the endings helpers are pure and live in ./compute.ts
// so client components can import them without pulling in prisma.
export { formatEndings, parseEndings };

export interface PricingSettings {
  // Markup applied to the net Malfini purchase price (percentage OF COST).
  malfiniMarkupPct: number;
  // Hungarian VAT. Applies to both product prices and the shipping fee, so the two
  // can never drift apart.
  vatPct: number;
  // Permitted last-two-digit endings for PRODUCT prices, e.g. [90] → …90.
  // See roundToEndings in ./compute.ts.
  priceEndings: number[];
  // Permitted endings for the SHIPPING fee, e.g. [50, 90]. Rounded UP, never down —
  // Kvikk's cost is fixed, so rounding down would ship at a loss (see lib/kvikk/pricing.ts).
  shippingPriceEndings: number[];
  // EUR→HUF rate, used only if Malfini ever returns EUR prices for this account
  // (it currently returns HUF). Replaces the former EUR_TO_HUF_RATE env var.
  eurHufRate: number;
  // Print fee charged per design object, gross HUF. The tier is decided by the
  // object's real-world size against A4 — see lib/pricing/printFee.ts.
  printFeeSmallHuf: number; // both dimensions within A4
  printFeeLargeHuf: number; // either dimension exceeds A4
}

export const PRICING_DEFAULTS: PricingSettings = {
  malfiniMarkupPct: 30,
  vatPct: 27,
  priceEndings: [90],
  shippingPriceEndings: [50, 90],
  eurHufRate: 400,
  printFeeSmallHuf: 3000,
  printFeeLargeHuf: 3500,
};

// Field ↔ database key mapping. Keys are stable; renaming a field is free.
const KEYS: Record<keyof PricingSettings, string> = {
  malfiniMarkupPct: "malfini_markup_pct",
  vatPct: "vat_pct",
  priceEndings: "price_endings",
  shippingPriceEndings: "shipping_price_endings",
  eurHufRate: "eur_huf_rate",
  printFeeSmallHuf: "print_fee_small_huf",
  printFeeLargeHuf: "print_fee_large_huf",
};

export const PRICING_SETTING_KEYS = Object.values(KEYS);

type NumberField = {
  [K in keyof PricingSettings]: PricingSettings[K] extends number ? K : never;
}[keyof PricingSettings];

type EndingsField = {
  [K in keyof PricingSettings]: PricingSettings[K] extends number[] ? K : never;
}[keyof PricingSettings];

// Accepted range per numeric field, with the Hungarian message shown when violated.
const NUMBER_BOUNDS: Record<
  NumberField,
  { min: number; max: number; integer: boolean; error: string }
> = {
  malfiniMarkupPct: {
    min: 0,
    max: 1000,
    integer: false,
    error: "Az árrés 0 és 1000% között lehet.",
  },
  vatPct: {
    min: 0,
    max: 100,
    integer: false,
    error: "Az ÁFA 0 és 100% között lehet.",
  },
  eurHufRate: {
    min: 1,
    max: 10000,
    integer: false,
    error: "Az árfolyam 1 és 10000 között lehet.",
  },
  printFeeSmallHuf: {
    min: 0,
    max: 1000000,
    integer: true,
    error:
      "Az A4-en belüli nyomtatási díj 0 és 1000000 Ft közötti egész szám legyen.",
  },
  printFeeLargeHuf: {
    min: 0,
    max: 1000000,
    integer: true,
    error:
      "Az A4-nél nagyobb nyomtatási díj 0 és 1000000 Ft közötti egész szám legyen.",
  },
};

const ENDINGS_ERRORS: Record<EndingsField, string> = {
  priceEndings:
    "A termékárak végződése 0 és 99 közötti egész számok vesszővel elválasztott listája legyen (pl. 90).",
  shippingPriceEndings:
    "A szállítási díj végződése 0 és 99 közötti egész számok vesszővel elválasztott listája legyen (pl. 50,90).",
};

const NUMBER_FIELDS = Object.keys(NUMBER_BOUNDS) as NumberField[];
const ENDINGS_FIELDS = Object.keys(ENDINGS_ERRORS) as EndingsField[];

function parseNumberSetting(
  field: NumberField,
  raw: string | undefined
): number {
  if (raw === undefined) return PRICING_DEFAULTS[field];
  const parsed = Number(raw);
  const b = NUMBER_BOUNDS[field];
  if (!Number.isFinite(parsed) || parsed < b.min || parsed > b.max) {
    console.error(
      `[pricing] Invalid stored value for ${KEYS[field]}: ${JSON.stringify(raw)} — using default.`
    );
    return PRICING_DEFAULTS[field];
  }
  return parsed;
}

function parseEndingsSetting(
  field: EndingsField,
  raw: string | undefined
): number[] {
  if (raw === undefined) return [...PRICING_DEFAULTS[field]];
  const parsed = parseEndings(raw);
  if (parsed === null) {
    console.error(
      `[pricing] Invalid stored value for ${KEYS[field]}: ${JSON.stringify(raw)} — using default.`
    );
    return [...PRICING_DEFAULTS[field]];
  }
  return parsed;
}

export async function getPricingSettings(): Promise<PricingSettings> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await prisma.pricingSetting.findMany({
      select: { key: true, value: true },
    });
  } catch (err) {
    // Never let a settings read take the storefront down — defaults still price correctly.
    console.error("[pricing] getPricingSettings failed, using defaults:", err);
    return { ...PRICING_DEFAULTS };
  }

  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as PricingSettings;
  for (const field of NUMBER_FIELDS) {
    out[field] = parseNumberSetting(field, byKey.get(KEYS[field]));
  }
  for (const field of ENDINGS_FIELDS) {
    out[field] = parseEndingsSetting(field, byKey.get(KEYS[field]));
  }
  return out;
}

/**
 * Validates a raw request body into a full PricingSettings.
 * Returns a user-facing (Hungarian) error on failure, mirroring
 * validateVariantInput() in lib/services/product.ts.
 */
export function validatePricingSettings(
  raw: unknown
): { ok: true; value: PricingSettings } | { ok: false; error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const out = {} as PricingSettings;

  for (const field of NUMBER_FIELDS) {
    const bound = NUMBER_BOUNDS[field];
    const value = Number(b[field]);
    if (b[field] === undefined || b[field] === null || b[field] === "") {
      return { ok: false, error: bound.error };
    }
    if (!Number.isFinite(value) || value < bound.min || value > bound.max) {
      return { ok: false, error: bound.error };
    }
    if (bound.integer && !Number.isInteger(value)) {
      return { ok: false, error: bound.error };
    }
    out[field] = value;
  }

  for (const field of ENDINGS_FIELDS) {
    const parsed = parseEndings(b[field]);
    if (parsed === null) {
      return { ok: false, error: ENDINGS_ERRORS[field] };
    }
    out[field] = parsed;
  }

  return { ok: true, value: out };
}

export async function updatePricingSettings(
  input: PricingSettings
): Promise<void> {
  const entries: { key: string; value: string }[] = [
    ...NUMBER_FIELDS.map((f) => ({ key: KEYS[f], value: String(input[f]) })),
    ...ENDINGS_FIELDS.map((f) => ({
      key: KEYS[f],
      value: formatEndings(input[f]),
    })),
  ];

  await prisma.$transaction(
    entries.map(({ key, value }) =>
      prisma.pricingSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );
}
