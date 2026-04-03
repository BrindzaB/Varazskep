// EUR → HUF conversion and retail markup for Malfini purchase prices.
// Both rates are configured via environment variables.

// Exchange rate: EUR → HUF. Default: 400.
function getRate(): number {
  const raw = process.env.EUR_TO_HUF_RATE;
  const parsed = raw ? parseFloat(raw) : NaN;
  return isNaN(parsed) || parsed <= 0 ? 400 : parsed;
}

// Markup multiplier applied on top of the Malfini purchase price to get retail price.
// Default: 1.5 (50% margin). Configure via MALFINI_MARKUP_MULTIPLIER env var.
export function getMarkupMultiplier(): number {
  const raw = process.env.MALFINI_MARKUP_MULTIPLIER;
  const parsed = raw ? parseFloat(raw) : NaN;
  return isNaN(parsed) || parsed <= 0 ? 1.5 : parsed;
}

// Converts a EUR purchase price to whole HUF (no fillér), without markup.
// Used internally — callers should use convertEurToRetailHuf for display prices.
export function convertEurToHuf(eurPrice: number): number {
  return Math.round(eurPrice * getRate());
}

// Converts a EUR purchase price to whole HUF retail price with markup applied.
export function convertEurToRetailHuf(eurPrice: number): number {
  return Math.round(eurPrice * getRate() * getMarkupMultiplier());
}
