import { describe, it, expect } from "vitest";
import {
  compareNamesHu,
  matchesSearch,
  normalizeForSearch,
  sortProducts,
} from "@/lib/shop/productList";
import { parsePopularKey, popularKey } from "@/lib/shop/popular";

describe("normalizeForSearch", () => {
  it("drops case and Hungarian accents", () => {
    expect(normalizeForSearch("  Bögre ŐSZI Párna ")).toBe("bogre oszi parna");
  });
});

describe("matchesSearch", () => {
  it("matches regardless of accents and case", () => {
    expect(matchesSearch(["Egyedi bögre"], "BOGRE")).toBe(true);
    expect(matchesSearch(["Egyedi bogre"], "bögre")).toBe(true);
  });

  it("requires every word, across fields", () => {
    expect(matchesSearch(["Basic", "Pólók"], "basic póló")).toBe(true);
    expect(matchesSearch(["Basic", "Pólók"], "basic bögre")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(matchesSearch(["Basic"], "   ")).toBe(true);
  });
});

describe("compareNamesHu", () => {
  it("orders by the Hungarian alphabet", () => {
    const names = ["Zero", "Öko", "Ocean", "Ász", "Basic"];
    expect([...names].sort(compareNamesHu)).toEqual([
      "Ász",
      "Basic",
      "Ocean",
      "Öko",
      "Zero",
    ]);
  });

  it("is case-insensitive", () => {
    expect(compareNamesHu("basic", "Basic")).toBe(0);
  });
});

describe("sortProducts", () => {
  const items = [
    { name: "Heavy", price: 3990 },
    { name: "Basic", price: 1990 },
    { name: "Párna", price: 0 }, // price unknown
    { name: "Bögre", price: 1990 },
  ];
  const sort = (s: "name" | "price-asc" | "price-desc") =>
    sortProducts(items, s, (i) => i.name, (i) => i.price).map((i) => i.name);

  it("sorts by name", () => {
    expect(sort("name")).toEqual(["Basic", "Bögre", "Heavy", "Párna"]);
  });

  it("sorts by price, ties by name, unknown prices last", () => {
    expect(sort("price-asc")).toEqual(["Basic", "Bögre", "Heavy", "Párna"]);
    expect(sort("price-desc")).toEqual(["Heavy", "Basic", "Bögre", "Párna"]);
  });

  it("does not mutate the input", () => {
    sort("price-desc");
    expect(items[0].name).toBe("Heavy");
  });
});

describe("popular keys", () => {
  it("round-trips both sources", () => {
    expect(parsePopularKey(popularKey({ source: "malfini", code: "129" }))).toEqual(
      { source: "malfini", code: "129" }
    );
    expect(
      parsePopularKey(popularKey({ source: "local", productId: "cm123" }))
    ).toEqual({ source: "local", productId: "cm123" });
  });

  it("rejects malformed keys", () => {
    for (const bad of ["", "129", "malfini:", "other:1", "local"]) {
      expect(parsePopularKey(bad)).toBeNull();
    }
  });
});
