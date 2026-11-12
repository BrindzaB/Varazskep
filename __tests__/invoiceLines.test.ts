import { describe, it, expect } from "vitest";
import { buildInvoice, invoiceLineName } from "@/lib/orders/invoiceLines";

const mug = {
  productName: "Egyedi bögre",
  colorName: "Fehér",
  sizeName: "330ml",
  quantity: 2,
  unitPriceHuf: 3490,
  printFeeHuf: 3000,
};
const shirt = {
  productName: "Heavy póló",
  colorName: "Fekete",
  sizeName: "M",
  quantity: 5,
  unitPriceHuf: 2990,
  printFeeHuf: 0,
};

describe("invoiceLineName", () => {
  it("joins product, colour and size, and marks printed lines", () => {
    expect(invoiceLineName(mug)).toBe("Egyedi bögre – Fehér – 330ml (egyedi nyomtatással)");
    expect(invoiceLineName(shirt)).toBe("Heavy póló – Fekete – M");
  });

  it("leaves out empty colour and size", () => {
    expect(invoiceLineName({ ...shirt, colorName: "", sizeName: " " })).toBe("Heavy póló");
  });
});

describe("buildInvoice", () => {
  const invoice = buildInvoice({
    items: [mug, shirt],
    shippingLabel: "GLS házhozszállítás",
    shippingCostHuf: 1490,
    vatPct: 27,
  });

  it("makes one line per cart line with the print fee in the unit price, plus shipping", () => {
    expect(
      invoice.lines.map((l) => [l.name, l.quantity, l.unitPriceGrossHuf, l.totalGrossHuf])
    ).toEqual([
      ["Egyedi bögre – Fehér – 330ml (egyedi nyomtatással)", 2, 6490, 12980],
      ["Heavy póló – Fekete – M", 5, 2990, 14950],
      ["GLS házhozszállítás", 1, 1490, 1490],
    ]);
  });

  it("adds up to what the customer paid", () => {
    expect(invoice.grossHuf).toBe(12980 + 14950 + 1490);
  });

  it("splits every line into whole-forint net and VAT that sum to the gross", () => {
    for (const l of invoice.lines) {
      expect(Number.isInteger(l.netHuf)).toBe(true);
      expect(l.netHuf + l.vatHuf).toBe(l.totalGrossHuf);
    }
    expect(invoice.lines[2].netHuf).toBe(Math.round(1490 / 1.27)); // 1173
    expect(invoice.netHuf + invoice.vatHuf).toBe(invoice.grossHuf);
  });

  it("omits a free shipping line", () => {
    const free = buildInvoice({
      items: [shirt],
      shippingLabel: "x",
      shippingCostHuf: 0,
      vatPct: 27,
    });
    expect(free.lines).toHaveLength(1);
  });
});
