import { describe, it, expect } from "vitest";
import { validateOrderFormSubmission } from "@/lib/orderForm/validate";
import type { OrderFormProduct } from "@/lib/orderForm/types";

const catalog: OrderFormProduct[] = [
  {
    key: "malfini:129",
    name: "Basic – Pólók, Férfi",
    group: "Ruházat",
    colors: [
      {
        name: "Fekete",
        sizes: [
          { label: "M", ref: "1290113" },
          { label: "L", ref: "1290114" },
        ],
      },
    ],
  },
  {
    key: "local:prod_mug",
    name: "Egyedi bögre",
    group: "Bögrék",
    colors: [{ name: "Fehér", sizes: [{ label: "330ml", ref: "variant_1" }] }],
  },
];

const valid = {
  name: "  Teszt Kft. – Kiss Anna ",
  email: "anna@teszt.hu",
  phone: "06 30 123 4567",
  note: "Logó a mellre, 10 cm széles.",
  gdprConsent: true,
  website: "",
  lines: [
    { productKey: "malfini:129", ref: "1290114", quantity: 25 },
    { productKey: "local:prod_mug", ref: "variant_1", quantity: 10 },
  ],
  attachments: [
    {
      path: "2026-10/0b8f9c3e-1d2a-4c5b-9e7f-123456789abc.pdf",
      fileName: "logo.pdf",
    },
  ],
};

describe("validateOrderFormSubmission", () => {
  it("resolves lines from the catalogue, not from the request", () => {
    const result = validateOrderFormSubmission(valid, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Teszt Kft. – Kiss Anna");
    expect(result.value.phone).toBe("+36301234567");
    expect(result.value.lines).toEqual([
      {
        source: "malfini",
        productSizeCode: "1290114",
        productCode: "129",
        productName: "Basic – Pólók, Férfi",
        colorName: "Fekete",
        sizeName: "L",
        quantity: 25,
      },
      {
        source: "local",
        variantId: "variant_1",
        productName: "Egyedi bögre",
        colorName: "Fehér",
        sizeName: "330ml",
        quantity: 10,
      },
    ]);
  });

  it("accepts an order described only in the free text", () => {
    const result = validateOrderFormSubmission(
      { ...valid, lines: [], attachments: [] },
      catalog
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a size that belongs to a different product", () => {
    const result = validateOrderFormSubmission(
      {
        ...valid,
        lines: [{ productKey: "local:prod_mug", ref: "1290114", quantity: 1 }],
      },
      catalog
    );
    expect(result.ok).toBe(false);
  });

  it.each([0, -3, 2.5, 10001])("rejects quantity %s", (quantity) => {
    const result = validateOrderFormSubmission(
      {
        ...valid,
        lines: [{ productKey: "malfini:129", ref: "1290113", quantity }],
      },
      catalog
    );
    expect(result.ok).toBe(false);
  });

  it("requires name, a valid email and phone, the note and consent", () => {
    for (const patch of [
      { name: " " },
      { email: "nem-email" },
      { phone: "12345" },
      { note: "" },
      { gdprConsent: false },
    ]) {
      expect(validateOrderFormSubmission({ ...valid, ...patch }, catalog).ok).toBe(
        false
      );
    }
  });

  it("only accepts attachment paths issued by the upload route", () => {
    for (const attachment of [
      { path: "../secrets/x.pdf", fileName: "x.pdf" },
      { path: "uploads/logo.pdf", fileName: "logo.pdf" },
      // extension of the name must match the stored object
      {
        path: "2026-10/0b8f9c3e-1d2a-4c5b-9e7f-123456789abc.pdf",
        fileName: "logo.png",
      },
      // not an allowed type
      {
        path: "2026-10/0b8f9c3e-1d2a-4c5b-9e7f-123456789abc.exe",
        fileName: "logo.exe",
      },
    ]) {
      expect(
        validateOrderFormSubmission({ ...valid, attachments: [attachment] }, catalog)
          .ok
      ).toBe(false);
    }
  });

  it("rejects too many lines", () => {
    const lines = Array.from({ length: 31 }, () => valid.lines[0]);
    expect(validateOrderFormSubmission({ ...valid, lines }, catalog).ok).toBe(
      false
    );
  });
});
