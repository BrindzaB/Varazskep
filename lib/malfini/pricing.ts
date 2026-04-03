// EUR → HUF conversion for Malfini prices.
// This account returns prices in HUF, so convertEurToHuf is a fallback for accounts
// that return EUR prices. buildPriceMap() checks the currency field before calling it.

// Exchange rate: EUR → HUF. Default: 400. Configure via EUR_TO_HUF_RATE env var.
function getRate(): number {
  const raw = process.env.EUR_TO_HUF_RATE;
  const parsed = raw ? parseFloat(raw) : NaN;
  return isNaN(parsed) || parsed <= 0 ? 400 : parsed;
}

// Converts a EUR price to whole HUF. Passed into buildPriceMap() as a converter.
export function convertEurToHuf(eurPrice: number): number {
  return Math.round(eurPrice * getRate());
}
