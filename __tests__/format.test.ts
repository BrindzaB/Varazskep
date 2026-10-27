import { describe, it, expect } from "vitest";
import { formatHuf } from "@/lib/utils/format";

// Non-breaking spaces keep a price on one line.
const nb = (s: string) => s.replace(/ /g, " ");

describe("formatHuf", () => {
  it("groups every price by thousands, four digits included", () => {
    expect(formatHuf(990)).toBe(nb("990 Ft"));
    expect(formatHuf(4990)).toBe(nb("4 990 Ft"));
    expect(formatHuf(12990)).toBe(nb("12 990 Ft"));
    expect(formatHuf(1234567)).toBe(nb("1 234 567 Ft"));
  });

  it("rounds and keeps the sign", () => {
    expect(formatHuf(0)).toBe(nb("0 Ft"));
    expect(formatHuf(1499.6)).toBe(nb("1 500 Ft"));
    expect(formatHuf(-2500)).toBe(nb("-2 500 Ft"));
  });
});
