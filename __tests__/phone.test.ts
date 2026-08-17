import { describe, it, expect } from "vitest";
import {
  normalizeHungarianPhone,
  isValidHungarianPhone,
} from "@/lib/utils/phone";

describe("normalizeHungarianPhone", () => {
  it("normalizes mobile numbers from every common input format to +36…", () => {
    // All of these are the same mobile number, differently formatted.
    expect(normalizeHungarianPhone("+36 20 123 4567")).toBe("+36201234567");
    expect(normalizeHungarianPhone("+36201234567")).toBe("+36201234567");
    expect(normalizeHungarianPhone("06 20 123 4567")).toBe("+36201234567");
    expect(normalizeHungarianPhone("0036 20 123 4567")).toBe("+36201234567");
    expect(normalizeHungarianPhone("06-20-123-4567")).toBe("+36201234567");
    expect(normalizeHungarianPhone("201234567")).toBe("+36201234567"); // bare national
  });

  it("accepts all Hungarian mobile prefixes", () => {
    for (const p of ["20", "30", "31", "50", "70"]) {
      expect(normalizeHungarianPhone(`+36 ${p} 123 4567`)).toBe(
        `+36${p}1234567`
      );
    }
  });

  it("accepts landline numbers (8-digit national)", () => {
    expect(normalizeHungarianPhone("+36 1 234 5678")).toBe("+3612345678"); // Budapest
    expect(normalizeHungarianPhone("06 25 123 456")).toBe("+3625123456"); // Dunaújváros
  });

  it("rejects numbers that are not recognizable Hungarian numbers", () => {
    expect(normalizeHungarianPhone("")).toBeNull();
    expect(normalizeHungarianPhone("123")).toBeNull(); // too short
    expect(normalizeHungarianPhone("06 20 123")).toBeNull(); // too short national
    expect(normalizeHungarianPhone("+36 20 123 4567 890")).toBeNull(); // too long
    expect(normalizeHungarianPhone("abcdef")).toBeNull(); // no digits
    expect(normalizeHungarianPhone("+1 202 555 0100")).toBeNull(); // non-HU
  });
});

describe("isValidHungarianPhone", () => {
  it("mirrors normalizeHungarianPhone success/failure", () => {
    expect(isValidHungarianPhone("+36 20 123 4567")).toBe(true);
    expect(isValidHungarianPhone("06 1 234 5678")).toBe(true);
    expect(isValidHungarianPhone("nope")).toBe(false);
    expect(isValidHungarianPhone("")).toBe(false);
  });
});
