// Legacy shipping-method labels — kept ONLY to render historical (pre-Kvikk) orders via
// lib/shipping/display.ts. New orders use the Kvikk courier + deliveryType fields; prices
// come dynamically from Kvikk (lib/kvikk/pricing.ts), not from any hardcoded table here.
export const SHIPPING_LABELS = {
  FOXPOST_LOCKER: "Foxpost csomagautomata",
  MPL_HOME_DELIVERY: "MPL házhozszállítás",
} as const;
