import { describe, it, expect, vi } from "vitest";

// lib/pricing/overrides.ts imports prisma at module load; only its pure validators
// are exercised here.
vi.mock("@/lib/db", () => ({
  prisma: {
    priceOverride: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import {
  validatePriceOverrides,
  validateSkuList,
} from "@/lib/pricing/overrides";

describe("validatePriceOverrides", () => {
  const one = {
    productSizeCode: "1670712",
    productCode: "167",
    priceHuf: 1199,
  };

  it("accepts a single override", () => {
    expect(validatePriceOverrides({ overrides: [one] })).toEqual({
      ok: true,
      value: [one],
    });
  });

  it("accepts a bulk payload for a whole product", () => {
    const many = [
      one,
      { ...one, productSizeCode: "1670713" },
      { ...one, productSizeCode: "1670714" },
    ];
    const result = validatePriceOverrides({ overrides: many });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(3);
  });

  it("trims the identifiers", () => {
    const result = validatePriceOverrides({
      overrides: [
        { ...one, productSizeCode: " 1670712 ", productCode: " 167 " },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].productSizeCode).toBe("1670712");
      expect(result.value[0].productCode).toBe("167");
    }
  });

  it("rejects an empty or missing list", () => {
    expect(validatePriceOverrides({ overrides: [] }).ok).toBe(false);
    expect(validatePriceOverrides({}).ok).toBe(false);
    expect(validatePriceOverrides(null).ok).toBe(false);
  });

  it("rejects a duplicated SKU rather than letting one silently win", () => {
    const result = validatePriceOverrides({ overrides: [one, { ...one }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("1670712");
  });

  it("rejects a missing identifier", () => {
    expect(
      validatePriceOverrides({ overrides: [{ ...one, productCode: "" }] }).ok
    ).toBe(false);
    expect(
      validatePriceOverrides({ overrides: [{ ...one, productSizeCode: "" }] })
        .ok
    ).toBe(false);
  });

  it("rejects a non-positive, fractional or non-numeric price", () => {
    for (const priceHuf of [0, -100, 1199.5, "sok", null, undefined, NaN]) {
      expect(
        validatePriceOverrides({ overrides: [{ ...one, priceHuf }] }).ok
      ).toBe(false);
    }
  });

  it("coerces a numeric string, as validateVariantInput does", () => {
    const result = validatePriceOverrides({
      overrides: [{ ...one, priceHuf: "1199" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0].priceHuf).toBe(1199);
  });

  it("rejects an absurd price — most likely an extra digit", () => {
    expect(
      validatePriceOverrides({ overrides: [{ ...one, priceHuf: 99_000_000 }] })
        .ok
    ).toBe(false);
  });
});

describe("validateSkuList", () => {
  it("accepts and de-duplicates a list", () => {
    const result = validateSkuList({
      productSizeCodes: ["1670712", "1670713", "1670712"],
    });
    expect(result).toEqual({ ok: true, value: ["1670712", "1670713"] });
  });

  it("rejects an empty list", () => {
    expect(validateSkuList({ productSizeCodes: [] }).ok).toBe(false);
    expect(validateSkuList({}).ok).toBe(false);
  });

  it("rejects a non-string or blank entry", () => {
    expect(validateSkuList({ productSizeCodes: [123] }).ok).toBe(false);
    expect(validateSkuList({ productSizeCodes: ["  "] }).ok).toBe(false);
  });
});
