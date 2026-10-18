import { describe, it, expect } from "vitest";
import {
  decodeCartItems,
  encodeCartItems,
  type CartItemMeta,
} from "@/lib/checkout/cartMetadata";

function line(i: number): CartItemMeta {
  return {
    source: "malfini",
    productSizeCode: `12900${String(i).padStart(2, "0")}`,
    productCode: "129",
    productName: "Heavy póló – unisex rövid ujjú pamut póló",
    colorName: "Fekete",
    sizeName: "XL",
    quantity: 10 + i,
    unitPriceHuf: 2990,
    printFeeHuf: 3000,
    designId: `clxdesign00000000000000${i}`,
  };
}

describe("cart metadata", () => {
  it("round-trips many lines, each within Stripe's 500-char value limit", () => {
    // A single JSON value for all lines (the old format) overflowed at ~2 lines.
    const items = Array.from({ length: 30 }, (_, i) => line(i));
    const encoded = encodeCartItems(items);
    expect(encoded).not.toBeNull();
    for (const value of Object.values(encoded!)) {
      expect(value.length).toBeLessThanOrEqual(500);
    }
    expect(decodeCartItems(encoded!)).toEqual(items);
  });

  it("rejects a line that does not fit a metadata value", () => {
    expect(
      encodeCartItems([{ ...line(0), productName: "x".repeat(500) }])
    ).toBeNull();
  });

  it("decodes to nothing when a line is missing or malformed", () => {
    const encoded = encodeCartItems([line(0), line(1)])!;
    expect(decodeCartItems({ ...encoded, item_1: "" })).toEqual([]);
    expect(
      decodeCartItems({
        ...encoded,
        item_1: JSON.stringify({ ...line(1), quantity: 0 }),
      })
    ).toEqual([]);
    expect(decodeCartItems({ ...encoded, itemCount: "3" })).toEqual([]);
  });

  it("decodes to nothing without an item count", () => {
    expect(decodeCartItems({})).toEqual([]);
  });
});
