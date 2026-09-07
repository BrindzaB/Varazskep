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
  roundToEndings,
} from "@/lib/pricing/compute";
import {
  formatEndings,
  parseEndings,
  validatePricingSettings,
  PRICING_DEFAULTS,
} from "@/lib/pricing/settings";
import { buildCostMap } from "@/lib/malfini/client";
import type { MalfiniProductPrice } from "@/lib/malfini/types";

// The default formula the shop ships with: 30% markup on net cost, 27% VAT, …90 prices.
const DEFAULT_FORMULA = {
  markupPct: PRICING_DEFAULTS.malfiniMarkupPct,
  vatPct: PRICING_DEFAULTS.vatPct,
  endings: PRICING_DEFAULTS.priceEndings,
};

describe("roundToEndings", () => {
  it("snaps product prices to the nearest …90", () => {
    expect(roundToEndings(1981.2, [90])).toBe(1990);
    expect(roundToEndings(2004.3, [90])).toBe(1990);
    expect(roundToEndings(2756, [90])).toBe(2790);
    expect(roundToEndings(751.3, [90])).toBe(790);
  });

  it("crosses the block boundary when the upper ending is nearer", () => {
    // 2045 is 55 above 1990 but only 45 below 2090.
    expect(roundToEndings(2045, [90])).toBe(2090);
    expect(roundToEndings(2039, [90])).toBe(1990);
  });

  it("keeps the lower price on an exact tie", () => {
    // Midway between 1990 and 2090.
    expect(roundToEndings(2040, [90])).toBe(1990);
  });

  it("supports several endings per block", () => {
    // Shipping permits …50 and …90.
    expect(roundToEndings(1473, [50, 90])).toBe(1490);
    expect(roundToEndings(1016, [50, 90])).toBe(990);
    expect(roundToEndings(1194, [50, 90])).toBe(1190);
    expect(roundToEndings(1600, [50, 90])).toBe(1590);
  });

  it('only ever rounds up in "up" mode', () => {
    // The shipping fee must never land under the courier's cost.
    expect(roundToEndings(1016, [50, 90], "up")).toBe(1050);
    expect(roundToEndings(1473, [50, 90], "up")).toBe(1490);
    expect(roundToEndings(1600, [50, 90], "up")).toBe(1650);
    expect(roundToEndings(2007, [50, 90], "up")).toBe(2050);
  });

  it('leaves a value already on an ending untouched in "up" mode', () => {
    expect(roundToEndings(1490, [50, 90], "up")).toBe(1490);
    expect(roundToEndings(1050, [50, 90], "up")).toBe(1050);
  });

  it("always lands on one of the permitted endings", () => {
    for (const v of [751, 1238, 2045, 3210, 6934, 28716]) {
      expect(roundToEndings(v, [90]) % 100).toBe(90);
      expect([50, 90]).toContain(roundToEndings(v, [50, 90]) % 100);
      expect([50, 90]).toContain(roundToEndings(v, [50, 90], "up") % 100);
    }
  });

  it("never returns a non-positive price", () => {
    expect(roundToEndings(10, [90])).toBe(90);
    expect(roundToEndings(10, [50, 90])).toBe(50);
  });

  it("ignores out-of-range endings", () => {
    expect(roundToEndings(1981.2, [90, 150, -5, 1.5])).toBe(1990);
  });

  it("falls back to whole forints when no ending is usable", () => {
    expect(roundToEndings(1864.4, [])).toBe(1864);
    expect(roundToEndings(1864.6, [200])).toBe(1865);
  });

  it("returns 0 for a non-finite or non-positive input", () => {
    expect(roundToEndings(NaN, [90])).toBe(0);
    expect(roundToEndings(0, [90])).toBe(0);
    expect(roundToEndings(-5, [90])).toBe(0);
  });
});

describe("computeGrossPrice", () => {
  it("matches the shop's worked example", () => {
    // 1200 × 1.30 = 1560 net → × 1.27 = 1981.2 gross → 1990 on the …90 endings.
    expect(computeGrossPrice(1200, DEFAULT_FORMULA)).toBe(1990);
  });

  it("prices the reference SKU from its real purchase cost", () => {
    // SKU 1340012, net cost 1214 Ft from GET /product/prices.
    // 1214 × 1.30 = 1578.2 → × 1.27 = 2004.3 → 1990.
    expect(computeGrossPrice(1214, DEFAULT_FORMULA)).toBe(1990);
  });

  it("applies the markup to cost, then VAT to the marked-up net price", () => {
    // No endings → exact arithmetic, so the two steps can be checked in isolation.
    const gross = computeGrossPrice(1000, {
      markupPct: 30,
      vatPct: 27,
      endings: [],
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
      computeGrossPrice(1000, { markupPct: 0, vatPct: 27, endings: [] })
    ).toBe(1270);
  });
});

describe("realisedMarkupPct", () => {
  it("stays near the configured markup on the …90 endings", () => {
    const gross = computeGrossPrice(1214, DEFAULT_FORMULA); // 1990
    expect(realisedMarkupPct(gross, 1214, 27)).toBeCloseTo(29.07, 2);
  });

  it("is the ratio of profit to cost, not to revenue", () => {
    // Net selling price 1560 on a cost of 1200 → 360 profit → 30% of cost.
    expect(realisedMarkupPct(1560 * 1.27, 1200, 27)).toBeCloseTo(30, 6);
  });

  it("is negative when the price does not cover the cost", () => {
    expect(realisedMarkupPct(1000, 1214, 27)).toBeLessThan(0);
  });

  it("returns 0 rather than dividing by zero", () => {
    expect(realisedMarkupPct(1990, 0, 27)).toBe(0);
  });
});

describe("profitPerPieceHuf", () => {
  it("reports the forints kept per piece", () => {
    const gross = computeGrossPrice(1200, DEFAULT_FORMULA); // 1990
    // 1990 / 1.27 = 1566.9 net revenue, less the 1200 cost.
    expect(profitPerPieceHuf(gross, 1200, 27)).toBeCloseTo(366.9, 0);
  });
});

describe("parseEndings / formatEndings", () => {
  it("parses a comma-separated list", () => {
    expect(parseEndings("50,90")).toEqual([50, 90]);
    expect(parseEndings("90")).toEqual([90]);
    expect(parseEndings(" 90 , 50 ")).toEqual([50, 90]);
  });

  it("sorts and de-duplicates", () => {
    expect(parseEndings("90,50,90")).toEqual([50, 90]);
  });

  it("accepts an array as well as a string", () => {
    expect(parseEndings([90, 50])).toEqual([50, 90]);
  });

  it("keeps 0 as a valid ending", () => {
    expect(parseEndings("0")).toEqual([0]);
  });

  it("rejects anything outside 0–99 or non-integer", () => {
    for (const bad of [
      "100",
      "-1",
      "1.5",
      "kilencven",
      "",
      "50,",
      ",",
      null,
      5.5,
    ]) {
      expect(parseEndings(bad)).toBeNull();
    }
  });

  it("rejects an absurdly long list", () => {
    expect(parseEndings(Array.from({ length: 11 }, (_, i) => i))).toBeNull();
  });

  it("round-trips through formatEndings", () => {
    expect(parseEndings(formatEndings([50, 90]))).toEqual([50, 90]);
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
    priceEndings: "90",
    shippingPriceEndings: "50,90",
    eurHufRate: 400,
    printFeeSmallHuf: 3000,
    printFeeLargeHuf: 3500,
  };

  it("accepts a well-formed payload and normalises the endings", () => {
    const result = validatePricingSettings(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priceEndings).toEqual([90]);
      expect(result.value.shippingPriceEndings).toEqual([50, 90]);
      expect(result.value.malfiniMarkupPct).toBe(30);
    }
  });

  it("rejects an out-of-range markup", () => {
    expect(validatePricingSettings({ ...valid, malfiniMarkupPct: -1 }).ok).toBe(
      false
    );
  });

  it("rejects an unusable endings list", () => {
    expect(validatePricingSettings({ ...valid, priceEndings: "100" }).ok).toBe(
      false
    );
    expect(validatePricingSettings({ ...valid, priceEndings: "" }).ok).toBe(
      false
    );
    expect(
      validatePricingSettings({ ...valid, shippingPriceEndings: "abc" }).ok
    ).toBe(false);
  });

  it("rejects a missing field rather than silently defaulting it", () => {
    const { vatPct: _omittedVat, ...withoutVat } = valid;
    expect(validatePricingSettings(withoutVat).ok).toBe(false);
    const { priceEndings: _omittedEndings, ...withoutEndings } = valid;
    expect(validatePricingSettings(withoutEndings).ok).toBe(false);
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
