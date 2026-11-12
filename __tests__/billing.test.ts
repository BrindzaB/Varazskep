import { describe, it, expect } from "vitest";
import {
  decodeBilling,
  formatBillingLines,
  normalizeTaxNumber,
  resolveBilling,
  validateBillingRequest,
} from "@/lib/checkout/billing";

const home = {
  homeDelivery: true,
  address: { address: "Fő utca 1", city: "Budapest", postalCode: "1011" },
};
const point = { ...home, homeDelivery: false };
const otherAddress = { address: "Váci út 10", city: "Budapest", postalCode: "1132" };

describe("normalizeTaxNumber", () => {
  it("accepts the dashed and the compact form", () => {
    expect(normalizeTaxNumber("12345678-2-41")).toBe("12345678-2-41");
    expect(normalizeTaxNumber("12345678241")).toBe("12345678-2-41");
    expect(normalizeTaxNumber(" 12345678 2 41 ")).toBe("12345678-2-41");
  });

  it("rejects anything that is not 11 digits", () => {
    expect(normalizeTaxNumber("1234567-2-41")).toBeNull();
    expect(normalizeTaxNumber("12345678-2-411")).toBeNull();
    expect(normalizeTaxNumber("HU12345678")).toBeNull();
    expect(normalizeTaxNumber("")).toBeNull();
  });
});

describe("validateBillingRequest", () => {
  it("requires company name and a valid tax number for a company", () => {
    expect(
      validateBillingRequest({ type: "COMPANY", address: null }, true)
    ).toMatchObject({ companyName: expect.any(String), taxNumber: expect.any(String) });
    expect(
      validateBillingRequest(
        { type: "COMPANY", companyName: "Teszt Kft.", taxNumber: "123", address: null },
        true
      )
    ).toEqual({ taxNumber: expect.any(String) });
  });

  it("allows 'same as shipping' only with home delivery", () => {
    expect(validateBillingRequest({ type: "PRIVATE", address: null }, true)).toEqual({});
    expect(validateBillingRequest({ type: "PRIVATE", address: null }, false)).toEqual({
      address: expect.any(String),
    });
  });

  it("checks the billing address fields", () => {
    expect(
      validateBillingRequest(
        { type: "PRIVATE", address: { address: "", city: "", postalCode: "12" } },
        false
      )
    ).toEqual({
      address: expect.any(String),
      city: expect.any(String),
      postalCode: expect.any(String),
    });
  });
});

describe("resolveBilling", () => {
  it("uses the customer's name and the shipping address for a private person", () => {
    expect(
      resolveBilling({ type: "PRIVATE", address: null }, " Teszt Elek ", home)
    ).toEqual({
      type: "PRIVATE",
      name: "Teszt Elek",
      address: { ...home.address, country: "HU" },
    });
  });

  it("uses the company name, canonical tax number and its own address", () => {
    expect(
      resolveBilling(
        {
          type: "COMPANY",
          companyName: "Teszt Kft.",
          taxNumber: "12345678241",
          address: otherAddress,
        },
        "Teszt Elek",
        point
      )
    ).toEqual({
      type: "COMPANY",
      name: "Teszt Kft.",
      taxNumber: "12345678-2-41",
      address: { ...otherAddress, country: "HU" },
    });
  });

  it("ignores a tax number sent for a private person", () => {
    const billing = resolveBilling(
      { type: "PRIVATE", taxNumber: "12345678241", address: null },
      "Teszt Elek",
      home
    );
    expect(billing).not.toHaveProperty("taxNumber");
  });

  it("rejects malformed and invalid requests", () => {
    expect(resolveBilling(undefined, "Teszt Elek", home)).toBeNull();
    expect(resolveBilling({ type: "OTHER", address: null }, "Teszt Elek", home)).toBeNull();
    expect(resolveBilling({ type: "PRIVATE", address: null }, "Teszt Elek", point)).toBeNull();
    expect(resolveBilling({ type: "PRIVATE", address: "x" }, "Teszt Elek", home)).toBeNull();
    expect(resolveBilling({ type: "PRIVATE", address: null }, " ", home)).toBeNull();
  });
});

describe("decodeBilling", () => {
  const company = resolveBilling(
    { type: "COMPANY", companyName: "Teszt Kft.", taxNumber: "12345678-2-41", address: otherAddress },
    "Teszt Elek",
    home
  )!;

  it("round-trips what the checkout route encodes", () => {
    expect(decodeBilling(JSON.stringify(company))).toEqual(company);
  });

  it("rejects missing, malformed or inconsistent values", () => {
    expect(decodeBilling(undefined)).toBeNull();
    expect(decodeBilling("{not json")).toBeNull();
    expect(decodeBilling(JSON.stringify({ ...company, taxNumber: undefined }))).toBeNull();
    expect(
      decodeBilling(JSON.stringify({ ...company, type: "PRIVATE" }))
    ).toBeNull();
    expect(decodeBilling(JSON.stringify({ ...company, address: null }))).toBeNull();
  });
});

describe("formatBillingLines", () => {
  it("lists name, tax number and address", () => {
    expect(
      formatBillingLines({
        type: "COMPANY",
        name: "Teszt Kft.",
        taxNumber: "12345678-2-41",
        address: { ...otherAddress, country: "HU" },
      })
    ).toEqual(["Teszt Kft.", "Adószám: 12345678-2-41", "1132 Budapest, Váci út 10"]);
  });
});
