import { describe, it, expect, vi } from "vitest";

// lib/pricing/settings.ts imports prisma at module load. Only its pure validation
// helpers are exercised here, so a stub client is enough to let the module load.
vi.mock("@/lib/db", () => ({
  prisma: {
    pricingSetting: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import {
  computeGrossPrice,
  netRevenue,
  profitPerPieceHuf,
  realisedMarkupPct,
  roundToPriceGrid,
} from "@/lib/pricing/compute";
import {
  validatePricingSettings,
  PRICING_DEFAULTS,
} from "@/lib/pricing/settings";
import { buildCostMap } from "@/lib/malfini/client";
import type { MalfiniProductPrice } from "@/lib/malfini/types";

// The default formula the shop ships with: 30% markup on net cost, 27% VAT, …99 prices.
const DEFAULT_FORMULA = {
  markupPct: PRICING_DEFAULTS.malfiniMarkupPct,
  vatPct: PRICING_DEFAULTS.vatPct,
  roundGridHuf: PRICING_DEFAULTS.roundGridHuf,
};

describe("roundToPriceGrid", () => {
  // The shop's rule at grid 100: "50-ig lefelé, utána felfelé".
  it("rounds down when the remainder is 50 or less", () => {
    expect(roundToPriceGrid(2045, 100)).toBe(1999);
    expect(roundToPriceGrid(2004.3, 100)).toBe(1999);
    expect(roundToPriceGrid(2050, 100)).toBe(1999);
    expect(roundToPriceGrid(1238, 100)).toBe(1199);
  });

  it("rounds up when the remainder is above 50", () => {
    expect(roundToPriceGrid(2051, 100)).toBe(2099);
    expect(roundToPriceGrid(2060, 100)).toBe(2099);
    expect(roundToPriceGrid(1981.2, 100)).toBe(1999);
    expect(roundToPriceGrid(2756, 100)).toBe(2799);
  });

  it("always lands one forint below a multiple of the grid", () => {
    for (const v of [751, 1238, 2045, 3210, 6934, 28716]) {
      expect(roundToPriceGrid(v, 100) % 100).toBe(99);
    }
  });

  it("generalises to a coarser grid", () => {
    // Grid 500 permits …499 / …999.
    expect(roundToPriceGrid(2045, 500)).toBe(1999);
    expect(roundToPriceGrid(2560, 500)).toBe(2499);
    expect(roundToPriceGrid(2756, 500)).toBe(2999);
  });

  it("never drops below the cheapest point the grid allows", () => {
    expect(roundToPriceGrid(40, 100)).toBe(99);
    expect(roundToPriceGrid(1, 100)).toBe(99);
  });

  it("returns whole forints for a grid of 1 or less", () => {
    expect(roundToPriceGrid(1864.4, 1)).toBe(1864);
    expect(roundToPriceGrid(1864.6, 0)).toBe(1865);
  });

  it("never returns NaN for a non-finite or non-positive input", () => {
    expect(roundToPriceGrid(NaN, 100)).toBe(0);
    expect(roundToPriceGrid(0, 100)).toBe(0);
    expect(roundToPriceGrid(-5, 100)).toBe(0);
  });
});

describe("computeGrossPrice", () => {
  it("matches the shop's worked example", () => {
    // 1200 × 1.30 = 1560 net → × 1.27 = 1981.2 gross → 1999 on the …99 grid.
    expect(computeGrossPrice(1200, DEFAULT_FORMULA)).toBe(1999);
  });

  it("prices the reference SKU from its real purchase cost", () => {
    // SKU 1340012, net cost 1214 Ft from GET /product/prices.
    // 1214 × 1.30 = 1578.2 → × 1.27 = 2004.3 → 1999.
    expect(computeGrossPrice(1214, DEFAULT_FORMULA)).toBe(1999);
  });

  it("applies the markup to cost, then VAT to the marked-up net price", () => {
    const gross = computeGrossPrice(1000, {
      markupPct: 30,
      vatPct: 27,
      roundGridHuf: 1,
    });
    expect(gross).toBe(Math.round(1000 * 1.3 * 1.27));
    expect(netRevenue(gross, 27)).toBeCloseTo(1300, 0);
  });

  it("returns 0 for a missing or nonsensical cost", () => {
    expect(computeGrossPrice(0, DEFAULT_FORMULA)).toBe(0);
    expect(computeGrossPrice(-5, DEFAULT_FORMULA)).toBe(0);
    expect(computeGrossPrice(NaN, DEFAULT_FORMULA)).toBe(0);
  });

  it("honours a zero markup", () => {
    expect(
      computeGrossPrice(1000, { markupPct: 0, vatPct: 27, roundGridHuf: 1 })
    ).toBe(1270);
  });
});

describe("realisedMarkupPct", () => {
  it("stays near the configured markup on the …99 grid", () => {
    // The grid moves the price a little, so the realised árrés drifts off 30%.
    const gross = computeGrossPrice(1214, DEFAULT_FORMULA); // 1999
    expect(realisedMarkupPct(gross, 1214, 27)).toBeCloseTo(29.66, 1);
  });

  it("is the ratio of profit to cost, not to revenue", () => {
    // Net selling price 1560 on a cost of 1200 → 360 profit → 30% of cost.
    expect(realisedMarkupPct(1560 * 1.27, 1200, 27)).toBeCloseTo(30, 6);
  });

  it("is negative when the price does not cover the cost", () => {
    expect(realisedMarkupPct(1000, 1214, 27)).toBeLessThan(0);
  });

  it("returns 0 rather than dividing by zero", () => {
    expect(realisedMarkupPct(1999, 0, 27)).toBe(0);
  });
});

describe("profitPerPieceHuf", () => {
  it("reports the forints kept per piece", () => {
    const gross = computeGrossPrice(1200, DEFAULT_FORMULA); // 1999
    // 1999 / 1.27 = 1574.0 net revenue, less the 1200 cost.
    expect(profitPerPieceHuf(gross, 1200, 27)).toBeCloseTo(374.0, 0);
  });
});

describe("buildCostMap", () => {
  const identity = (eur: number) => eur;

  // Real shape from GET /api/v4/product/prices.
  const rows: MalfiniProductPrice[] = [
    { productSizeCode: "1340012", limit: 1, price: 1214, currency: "HUF" },
    { productSizeCode: "1340012", limit: 10, price: 1189, currency: "HUF" },
    { productSizeCode: "1340012", limit: 100, price: 1164, currency: "HUF" },
    { productSizeCode: "1340012", limit: 1000, price: 1151, currency: "HUF" },
  ];

  it("keeps the lowest quantity tier, so the árrés is a conservative floor", () => {
    expect(buildCostMap(rows, identity)).toEqual({ "1340012": 1214 });
  });

  it("is order-independent", () => {
    expect(buildCostMap([...rows].reverse(), identity)).toEqual({
      "1340012": 1214,
    });
  });

  it("converts non-HUF prices and leaves HUF alone", () => {
    const map = buildCostMap(
      [
        { productSizeCode: "A", limit: 1, price: 10, currency: "EUR" },
        { productSizeCode: "B", limit: 1, price: 1214, currency: "HUF" },
      ],
      (eur) => eur * 400
    );
    expect(map).toEqual({ A: 4000, B: 1214 });
  });

  it("skips malformed rows instead of poisoning the map", () => {
    const map = buildCostMap(
      [
        { productSizeCode: "", limit: 1, price: 100, currency: "HUF" },
        { productSizeCode: "C", limit: 1, price: NaN, currency: "HUF" },
        { productSizeCode: "D", limit: 1, price: 500, currency: "HUF" },
      ],
      identity
    );
    expect(map).toEqual({ D: 500 });
  });
});

describe("validatePricingSettings", () => {
  const valid = {
    malfiniMarkupPct: 30,
    vatPct: 27,
    roundGridHuf: 100,
    eurHufRate: 400,
    printFeeSmallHuf: 3000,
    printFeeLargeHuf: 3500,
  };

  it("accepts a well-formed payload", () => {
    expect(validatePricingSettings(valid)).toEqual({ ok: true, value: valid });
  });

  it("rejects an out-of-range markup", () => {
    expect(validatePricingSettings({ ...valid, malfiniMarkupPct: -1 }).ok).toBe(
      false
    );
  });

  it("rejects a non-integer price grid", () => {
    expect(validatePricingSettings({ ...valid, roundGridHuf: 2.5 }).ok).toBe(
      false
    );
  });

  it("rejects a missing field rather than silently defaulting it", () => {
    const { vatPct: _omitted, ...withoutVat } = valid;
    expect(validatePricingSettings(withoutVat).ok).toBe(false);
  });

  it("rejects a non-numeric value", () => {
    expect(validatePricingSettings({ ...valid, vatPct: "sok" }).ok).toBe(false);
  });

  it("rejects a fractional print fee", () => {
    expect(
      validatePricingSettings({ ...valid, printFeeSmallHuf: 3000.5 }).ok
    ).toBe(false);
  });

  it("accepts a zero print fee", () => {
    expect(validatePricingSettings({ ...valid, printFeeSmallHuf: 0 }).ok).toBe(
      true
    );
  });

  it("rejects a null body", () => {
    expect(validatePricingSettings(null).ok).toBe(false);
  });
});
