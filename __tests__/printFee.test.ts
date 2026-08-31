import { describe, it, expect } from "vitest";
import {
  A4_HEIGHT_CM,
  A4_WIDTH_CM,
  computePrintFeeHuf,
  isLargeObject,
  objectSizeCm,
  PRINT_FEE_UNRESOLVABLE,
  type PrintFees,
} from "@/lib/pricing/printFee";
import type { CanvasJson } from "@/lib/services/design";

// The Malfini t-shirt designer config (lib/malfini/categoryConfig.ts).
const PRINT_AREA = { width: 220, height: 300, centerX: 250, centerY: 300 };
const PRINT_AREA_CM = { width: 38, height: 48 };
const FEES: PrintFees = { smallHuf: 3000, largeHuf: 3500 };

// A real object from design cmt7c19ve000004ju0vdmosm5, which the designer itself
// measured at 23.47 × 26.74 cm — wide enough to exceed A4's 21 cm width.
const REAL_LARGE_OBJECT = {
  type: "Image",
  width: 705,
  height: 867,
  scaleX: 0.1928,
  scaleY: 0.1928,
  _wCm: 23.47347109129809,
  _hCm: 26.74030534351145,
};

// From design cmt7bm214000404jxkzm0g9xy — 12.16 × 12.8 cm, inside A4.
const REAL_SMALL_OBJECT = {
  type: "Image",
  width: 543,
  height: 617,
  scaleX: 0.1297,
  scaleY: 0.1297,
  _wCm: 12.160895830263739,
  _hCm: 12.8,
};

describe("objectSizeCm", () => {
  // Fabric rounds serialized numbers to 2 fraction digits, while the designer measured
  // the object with its precise in-memory values. Recomputing from the stored numbers
  // therefore lands within ~0.02% rather than exactly — immaterial unless an object sits
  // within 0.005 cm of the A4 threshold.
  const withinPermille = (actual: number, expected: number) =>
    Math.abs(actual - expected) / expected < 0.001;

  it("reproduces the size the designer recorded for a real object", () => {
    const size = objectSizeCm(REAL_LARGE_OBJECT, PRINT_AREA, PRINT_AREA_CM);
    expect(size).not.toBeNull();
    expect(withinPermille(size!.wCm, REAL_LARGE_OBJECT._wCm)).toBe(true);
    expect(withinPermille(size!.hCm, REAL_LARGE_OBJECT._hCm)).toBe(true);
  });

  it("reproduces the size for a small real object", () => {
    const size = objectSizeCm(REAL_SMALL_OBJECT, PRINT_AREA, PRINT_AREA_CM);
    expect(withinPermille(size!.wCm, REAL_SMALL_OBJECT._wCm)).toBe(true);
    expect(withinPermille(size!.hCm, REAL_SMALL_OBJECT._hCm)).toBe(true);
  });

  it("defaults a missing scale to 1 rather than rejecting", () => {
    const size = objectSizeCm(
      { width: 220, height: 300 },
      PRINT_AREA,
      PRINT_AREA_CM
    );
    expect(size!.wCm).toBeCloseTo(38, 6);
    expect(size!.hCm).toBeCloseTo(48, 6);
  });

  it("returns null for unusable geometry", () => {
    for (const bad of [
      null,
      undefined,
      "not an object",
      {},
      { width: 100 },
      { width: 100, height: 0 },
      { width: 100, height: 100, scaleX: 0 },
      { width: 100, height: 100, scaleX: -1 },
      { width: NaN, height: 100 },
      { width: "100", height: "100" },
    ]) {
      expect(objectSizeCm(bad, PRINT_AREA, PRINT_AREA_CM)).toBeNull();
    }
  });
});

describe("isLargeObject", () => {
  it("uses either dimension, not area", () => {
    // A wide, short banner never reaches A4's area but must still be the large tier.
    expect(isLargeObject({ wCm: A4_WIDTH_CM + 0.1, hCm: 2 })).toBe(true);
    expect(isLargeObject({ wCm: 2, hCm: A4_HEIGHT_CM + 0.1 })).toBe(true);
  });

  it("treats exactly A4 as small", () => {
    expect(isLargeObject({ wCm: A4_WIDTH_CM, hCm: A4_HEIGHT_CM })).toBe(false);
  });
});

describe("computePrintFeeHuf", () => {
  const canvas = (front: unknown[], back: unknown[] = []): CanvasJson =>
    ({ front, back }) as CanvasJson;

  it("charges the large tier for a real oversized design", () => {
    const fee = computePrintFeeHuf(
      canvas([REAL_LARGE_OBJECT]),
      PRINT_AREA,
      PRINT_AREA_CM,
      FEES
    );
    expect(fee).toBe(3500);
  });

  it("charges the small tier for a real A4-sized design", () => {
    const fee = computePrintFeeHuf(
      canvas([REAL_SMALL_OBJECT]),
      PRINT_AREA,
      PRINT_AREA_CM,
      FEES
    );
    expect(fee).toBe(3000);
  });

  it("sums both sides", () => {
    const fee = computePrintFeeHuf(
      canvas([REAL_SMALL_OBJECT, REAL_SMALL_OBJECT], [REAL_LARGE_OBJECT]),
      PRINT_AREA,
      PRINT_AREA_CM,
      FEES
    );
    expect(fee).toBe(3000 + 3000 + 3500);
  });

  it("charges nothing for an empty design", () => {
    expect(
      computePrintFeeHuf(canvas([]), PRINT_AREA, PRINT_AREA_CM, FEES)
    ).toBe(0);
  });

  it("honours the admin-configured fees", () => {
    const fee = computePrintFeeHuf(
      canvas([REAL_SMALL_OBJECT], [REAL_LARGE_OBJECT]),
      PRINT_AREA,
      PRINT_AREA_CM,
      { smallHuf: 1500, largeHuf: 9000 }
    );
    expect(fee).toBe(10500);
  });

  it("tolerates a missing back array", () => {
    const fee = computePrintFeeHuf(
      { front: [REAL_SMALL_OBJECT] } as unknown as CanvasJson,
      PRINT_AREA,
      PRINT_AREA_CM,
      FEES
    );
    expect(fee).toBe(3000);
  });

  // ── Tamper resistance ──────────────────────────────────────────────────────

  it("ignores an understated _wCm and prices from the real geometry", () => {
    // The attack the stored _wCm/_hCm fields would enable: claim a tiny size while
    // keeping the scale that actually gets printed.
    const lying = { ...REAL_LARGE_OBJECT, _wCm: 1, _hCm: 1 };
    expect(
      computePrintFeeHuf(canvas([lying]), PRINT_AREA, PRINT_AREA_CM, FEES)
    ).toBe(3500);
  });

  it("rejects an object stripped of its geometry instead of charging nothing", () => {
    expect(() =>
      computePrintFeeHuf(
        canvas([{ type: "Image", _wCm: 1, _hCm: 1 }]),
        PRINT_AREA,
        PRINT_AREA_CM,
        FEES
      )
    ).toThrow(PRINT_FEE_UNRESOLVABLE);
  });

  it("rejects when only one object of several is malformed", () => {
    expect(() =>
      computePrintFeeHuf(
        canvas([REAL_SMALL_OBJECT, { type: "Image" }]),
        PRINT_AREA,
        PRINT_AREA_CM,
        FEES
      )
    ).toThrow(PRINT_FEE_UNRESOLVABLE);
  });

  it("prices a shrunken design cheaply — the print really is smaller", () => {
    // Scaling down to reach the cheap tier is allowed: the delivered artwork shrinks
    // with it, so there is nothing to gain. This documents that coupling.
    const shrunk = { ...REAL_LARGE_OBJECT, scaleX: 0.05, scaleY: 0.05 };
    expect(
      computePrintFeeHuf(canvas([shrunk]), PRINT_AREA, PRINT_AREA_CM, FEES)
    ).toBe(3000);
  });

  it("prices the same design higher on a larger print area", () => {
    // A mug's print area is physically much smaller, so the same canvas pixels are
    // fewer centimetres — which is why the area must come from server config.
    const mugArea = { width: 382, height: 170, centerX: 239, centerY: 155 };
    const mugAreaCm = { width: 20, height: 8 };
    const onShirt = computePrintFeeHuf(
      canvas([REAL_LARGE_OBJECT]),
      PRINT_AREA,
      PRINT_AREA_CM,
      FEES
    );
    const onMug = computePrintFeeHuf(
      canvas([REAL_LARGE_OBJECT]),
      mugArea,
      mugAreaCm,
      FEES
    );
    expect(onShirt).toBe(3500);
    expect(onMug).toBe(3000);
  });
});
