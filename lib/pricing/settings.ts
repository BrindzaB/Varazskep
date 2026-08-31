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

export interface PricingSettings {
  // Markup applied to the net Malfini purchase price (percentage OF COST).
  malfiniMarkupPct: number;
  // Hungarian VAT added on top of the marked-up net price.
  vatPct: number;
  // Price grid for the final gross price: prices land one forint below a multiple
  // of this (100 -> ...99). See roundToPriceGrid in ./compute.ts.
  roundGridHuf: number;
  // EUR→HUF rate, used only if Malfini ever returns EUR prices for this account
  // (it currently returns HUF). Replaces the former EUR_TO_HUF_RATE env var.
  eurHufRate: number;
}

export const PRICING_DEFAULTS: PricingSettings = {
  malfiniMarkupPct: 30,
  vatPct: 27,
  roundGridHuf: 100,
  eurHufRate: 400,
};

// Field ↔ database key mapping. Keys are stable; renaming a field is free.
const KEYS: Record<keyof PricingSettings, string> = {
  malfiniMarkupPct: "malfini_markup_pct",
  vatPct: "vat_pct",
  roundGridHuf: "round_grid_huf",
  eurHufRate: "eur_huf_rate",
};

export const PRICING_SETTING_KEYS = Object.values(KEYS);

// Accepted range per field, with the Hungarian message shown when it is violated.
const BOUNDS: Record<
  keyof PricingSettings,
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
  roundGridHuf: {
    min: 2,
    max: 10000,
    integer: true,
    error: "Az árrács 2 és 10000 Ft közötti egész szám legyen.",
  },
  eurHufRate: {
    min: 1,
    max: 10000,
    integer: false,
    error: "Az árfolyam 1 és 10000 között lehet.",
  },
};

function parseSetting(
  field: keyof PricingSettings,
  raw: string | undefined
): number {
  if (raw === undefined) return PRICING_DEFAULTS[field];
  const parsed = Number(raw);
  const b = BOUNDS[field];
  if (!Number.isFinite(parsed) || parsed < b.min || parsed > b.max) {
    console.error(
      `[pricing] Invalid stored value for ${KEYS[field]}: ${JSON.stringify(raw)} — using default.`
    );
    return PRICING_DEFAULTS[field];
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
  for (const field of Object.keys(KEYS) as (keyof PricingSettings)[]) {
    out[field] = parseSetting(field, byKey.get(KEYS[field]));
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

  for (const field of Object.keys(KEYS) as (keyof PricingSettings)[]) {
    const bound = BOUNDS[field];
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

  return { ok: true, value: out };
}

export async function updatePricingSettings(
  input: PricingSettings
): Promise<void> {
  const fields = Object.keys(KEYS) as (keyof PricingSettings)[];
  await prisma.$transaction(
    fields.map((field) => {
      const key = KEYS[field];
      const value = String(input[field]);
      return prisma.pricingSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    })
  );
}
