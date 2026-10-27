import { describe, it, expect } from "vitest";
import {
  CATEGORY_CONFIG,
  MALFINI_CATEGORY_LABELS,
  MALFINI_CATEGORY_ORDER,
  getProductDesignConfig,
  malfiniCategoryKey,
  malfiniCategoryLabel,
} from "@/lib/malfini/categoryConfig";
import { malfiniSizeLabel } from "@/lib/malfini/sizeOrder";
import { MALFINI_CATEGORY_ICONS } from "@/lib/shop/categoryIcons";

const product = (code: string, categoryCode: string, categoryName = "Táska") => ({
  code,
  categoryCode,
  categoryName,
});

describe("malfiniCategoryKey", () => {
  it("keeps the Malfini category for clothing", () => {
    expect(malfiniCategoryKey(product("129", "t-shirts"))).toBe("t-shirts");
  });

  it("splits the Malfini bags category per product", () => {
    expect(malfiniCategoryKey(product("912", "bags"))).toBe("gym-bags");
    expect(malfiniCategoryKey(product("921", "bags"))).toBe("tote-bags");
  });
});

describe("getProductDesignConfig", () => {
  it("configures the two selected bags", () => {
    expect(getProductDesignConfig(product("912", "bags"))?.hasSides).toBe(false);
    expect(getProductDesignConfig(product("921", "bags"))?.hasSides).toBe(true);
  });

  it("leaves every other bag unsold", () => {
    for (const code of ["900", "901", "922"]) {
      expect(getProductDesignConfig(product(code, "bags"))).toBeNull();
    }
  });

  it("leaves unconfigured categories unsold", () => {
    expect(getProductDesignConfig(product("B10", "caps"))).toBeNull();
  });
});

describe("malfiniCategoryLabel", () => {
  it("names the bag categories in Hungarian", () => {
    expect(malfiniCategoryLabel(product("912", "bags"))).toBe("Tornazsákok");
    expect(malfiniCategoryLabel(product("921", "bags"))).toBe("Vászontáskák");
  });

  it("falls back to the Malfini name", () => {
    expect(malfiniCategoryLabel(product("900", "bags"))).toBe("Táska");
  });
});

describe("category tables", () => {
  it("give every configured category a label, a tab position and an icon", () => {
    for (const key of Object.keys(CATEGORY_CONFIG)) {
      expect(MALFINI_CATEGORY_LABELS[key]).toBeTruthy();
      expect(MALFINI_CATEGORY_ORDER).toContain(key);
      expect(MALFINI_CATEGORY_ICONS[key]).toBeTruthy();
    }
  });
});

describe("malfiniSizeLabel", () => {
  it("names the one-size products", () => {
    expect(malfiniSizeLabel("uni")).toBe("Egy méret");
  });

  it("keeps real sizes", () => {
    expect(malfiniSizeLabel("XL")).toBe("XL");
  });
});
