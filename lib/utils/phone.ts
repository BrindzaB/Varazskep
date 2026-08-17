// Hungarian phone number normalization + validation.
//
// Kvikk requires the recipient phone and normalizes it to `+36…`; a number it cannot
// normalize is rejected with `invalid_phone_number` at shipment-creation time — long after
// the order is paid. We therefore normalize + validate the phone at checkout (client for
// instant feedback, server as the authority) so an unshippable number never gets stored.
//
// We validate the STRUCTURE (recognized prefix + national-number length), not an exact
// area-code table: Hungarian mobiles have a 9-digit national number (20/30/31/50/70 + 7),
// landlines an 8-digit one (area code + subscriber). Kvikk performs the final authoritative
// check, so we stay permissive on the destination code and strict on shape.

// Normalizes a Hungarian phone number to canonical `+36XXXXXXXX(X)` form, or returns null
// if the input is not a recognizable Hungarian number. Accepts common input formats:
// "+36 20 123 4567", "0036…", "06 20…", or a bare 8–9 digit national number.
export function normalizeHungarianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, ""); // drop spaces, dashes, parens, leading +, etc.

  let national: string | null = null;
  if (digits.startsWith("0036")) national = digits.slice(4);
  else if (digits.startsWith("36")) national = digits.slice(2);
  else if (digits.startsWith("06")) national = digits.slice(2);
  else if (/^\d{8,9}$/.test(digits)) national = digits; // bare national number

  if (national === null || !/^\d{8,9}$/.test(national)) return null;
  return `+36${national}`;
}

// True when the input is a normalizable Hungarian phone number (mobile or landline).
export function isValidHungarianPhone(input: string): boolean {
  return normalizeHungarianPhone(input) !== null;
}
