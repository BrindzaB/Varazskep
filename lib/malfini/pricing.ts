// EUR → HUF conversion for Malfini prices.
//
// This account returns prices in HUF (verified on both /product/prices and
// /product/recommended-prices), so these helpers are a safety net for accounts that
// return EUR. buildPriceMap()/buildCostMap() check the `currency` field before calling.
//
// The rate is an admin-editable pricing setting (PricingSettings.eurHufRate), not an
// env var. Because cost maps are cached catalog-wide, a rate change takes effect when
// the cache is next refreshed — irrelevant while the account returns HUF.

// Converts a EUR price to whole HUF at the given rate.
export function eurToHuf(eurPrice: number, rate: number): number {
  return Math.round(eurPrice * rate);
}

// Builds the converter that buildPriceMap()/buildCostMap() expect.
export function makeEurToHufConverter(rate: number): (eur: number) => number {
  return (eur) => eurToHuf(eur, rate);
}
