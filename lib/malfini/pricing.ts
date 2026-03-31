// EUR → HUF conversion for Malfini recommended retail prices.
// Exchange rate is configured via EUR_TO_HUF_RATE environment variable.
// Default: 400 (adjust as needed; Vercel env var takes effect without redeployment).

function getRate(): number {
  const raw = process.env.EUR_TO_HUF_RATE;
  const parsed = raw ? parseFloat(raw) : NaN;
  return isNaN(parsed) || parsed <= 0 ? 400 : parsed;
}

// Converts a EUR price to whole HUF (no fillér).
export function convertEurToHuf(eurPrice: number): number {
  return Math.round(eurPrice * getRate());
}
