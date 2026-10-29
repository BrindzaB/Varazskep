// Billing (invoice) data of a webshop order: who the invoice is made out to.
//
// The checkout form sends a BillingRequest; the checkout route resolves it against the
// shipping data into a BillingInfo, which travels through Stripe session metadata as one
// `billing` key and is stored on the Order by the webhook. Pure — shared by the form
// (client-side hints), the checkout route (authoritative check) and the webhook.

export type BillingType = "PRIVATE" | "COMPANY";

export interface BillingAddress {
  address: string;
  city: string;
  postalCode: string;
  country: string; // ISO-2 — always "HU": the shop only ships and invoices domestically
}

// What the checkout form submits.
export interface BillingRequest {
  type: BillingType;
  companyName?: string; // COMPANY only
  taxNumber?: string; // COMPANY only, any spacing/dash form
  // null = same as the shipping address (allowed for home delivery only — a delivery
  // point's address is not the customer's).
  address: Omit<BillingAddress, "country"> | null;
}

// The resolved billing data stored on the order.
export interface BillingInfo {
  type: BillingType;
  name: string; // the customer's name (PRIVATE) or the company name (COMPANY)
  taxNumber?: string; // canonical "12345678-1-12", COMPANY only
  address: BillingAddress;
}

export const BILLING_LIMITS = {
  name: 150,
  address: 150,
  city: 60,
} as const;

/**
 * Canonical form of a Hungarian tax number, or null if it is not one. Accepts the
 * 11 digits with or without the dashes and spaces ("12345678-1-12", "12345678112").
 * Only the 8-1-2 digit format is checked: the check-digit rule of the first eight
 * digits is not verified against an official source, so it is not applied here.
 */
export function normalizeTaxNumber(raw: string): string | null {
  const compact = raw.replace(/[\s-]/g, "");
  if (!/^\d{11}$/.test(compact)) return null;
  return `${compact.slice(0, 8)}-${compact.slice(8, 9)}-${compact.slice(9)}`;
}

export function isValidPostalCode(raw: string): boolean {
  return /^\d{4}$/.test(raw.trim());
}

export type BillingErrors = Partial<
  Record<"companyName" | "taxNumber" | "address" | "city" | "postalCode", string>
>;

/**
 * Field-level errors of a billing request; empty when it is valid. `sameAsShipping`
 * requests (address null) are only valid with home delivery.
 */
export function validateBillingRequest(
  req: BillingRequest,
  homeDelivery: boolean
): BillingErrors {
  const errors: BillingErrors = {};

  if (req.type === "COMPANY") {
    const companyName = req.companyName?.trim() ?? "";
    if (!companyName) errors.companyName = "A cégnév megadása kötelező.";
    else if (companyName.length > BILLING_LIMITS.name)
      errors.companyName = `A cégnév legfeljebb ${BILLING_LIMITS.name} karakter lehet.`;

    const taxNumber = req.taxNumber?.trim() ?? "";
    if (!taxNumber) errors.taxNumber = "Az adószám megadása kötelező.";
    else if (!normalizeTaxNumber(taxNumber))
      errors.taxNumber = "Érvénytelen adószám. Formátum: 12345678-1-12.";
  }

  if (req.address === null) {
    if (!homeDelivery)
      errors.address = "Átvételi pontos szállításnál adja meg a számlázási címet.";
  } else {
    const { address, city, postalCode } = req.address;
    if (!address.trim()) errors.address = "A cím megadása kötelező.";
    else if (address.trim().length > BILLING_LIMITS.address)
      errors.address = `A cím legfeljebb ${BILLING_LIMITS.address} karakter lehet.`;
    if (!city.trim()) errors.city = "A város megadása kötelező.";
    else if (city.trim().length > BILLING_LIMITS.city)
      errors.city = `A város legfeljebb ${BILLING_LIMITS.city} karakter lehet.`;
    if (!postalCode.trim())
      errors.postalCode = "Az irányítószám megadása kötelező.";
    else if (!isValidPostalCode(postalCode))
      errors.postalCode = "Az irányítószám 4 számjegyből áll.";
  }

  return errors;
}

/**
 * Validates an untrusted billing request and resolves it into the stored BillingInfo.
 * Returns null when the request is malformed or invalid.
 */
export function resolveBilling(
  raw: unknown,
  customerName: string,
  shipping: { homeDelivery: boolean; address: Omit<BillingAddress, "country"> }
): BillingInfo | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.type !== "PRIVATE" && r.type !== "COMPANY") return null;
  if (r.companyName !== undefined && typeof r.companyName !== "string") return null;
  if (r.taxNumber !== undefined && typeof r.taxNumber !== "string") return null;

  let address: Omit<BillingAddress, "country"> | null = null;
  if (r.address !== null) {
    if (typeof r.address !== "object" || r.address === undefined) return null;
    const a = r.address as Record<string, unknown>;
    if (
      typeof a.address !== "string" ||
      typeof a.city !== "string" ||
      typeof a.postalCode !== "string"
    )
      return null;
    address = { address: a.address, city: a.city, postalCode: a.postalCode };
  }

  const req: BillingRequest = {
    type: r.type,
    companyName: r.companyName as string | undefined,
    taxNumber: r.taxNumber as string | undefined,
    address,
  };
  if (Object.keys(validateBillingRequest(req, shipping.homeDelivery)).length > 0)
    return null;

  const resolvedAddress = address ?? shipping.address;
  const name =
    req.type === "COMPANY" ? req.companyName!.trim() : customerName.trim();
  if (!name || name.length > BILLING_LIMITS.name) return null;

  return {
    type: req.type,
    name,
    ...(req.type === "COMPANY"
      ? { taxNumber: normalizeTaxNumber(req.taxNumber!)! }
      : {}),
    address: {
      address: resolvedAddress.address.trim(),
      city: resolvedAddress.city.trim(),
      postalCode: resolvedAddress.postalCode.trim(),
      country: "HU",
    },
  };
}

/** Display lines of the billing data, for emails and the confirmation page. */
export function formatBillingLines(billing: BillingInfo): string[] {
  const { address, city, postalCode } = billing.address;
  return [
    billing.name,
    ...(billing.taxNumber ? [`Adószám: ${billing.taxNumber}`] : []),
    `${postalCode} ${city}, ${address}`,
  ];
}

/** Reads the `billing` metadata value back in the webhook; null if missing or malformed. */
export function decodeBilling(raw: string | undefined): BillingInfo | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const b = parsed as Record<string, unknown>;
  if (b.type !== "PRIVATE" && b.type !== "COMPANY") return null;
  if (typeof b.name !== "string" || !b.name) return null;
  if (b.type === "COMPANY") {
    if (typeof b.taxNumber !== "string" || !normalizeTaxNumber(b.taxNumber))
      return null;
  } else if (b.taxNumber !== undefined) return null;
  if (typeof b.address !== "object" || b.address === null) return null;
  const a = b.address as Record<string, unknown>;
  if (
    typeof a.address !== "string" ||
    typeof a.city !== "string" ||
    typeof a.postalCode !== "string" ||
    typeof a.country !== "string"
  )
    return null;
  return parsed as BillingInfo;
}
