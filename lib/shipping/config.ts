export const SHIPPING_PRICES = {
  FOXPOST_LOCKER: 990,
  MPL_HOME_DELIVERY: 1490,
} as const;

export const SHIPPING_LABELS = {
  FOXPOST_LOCKER: "Foxpost csomagautomata",
  MPL_HOME_DELIVERY: "MPL házhozszállítás",
} as const;

export type ShippingMethodKey = keyof typeof SHIPPING_PRICES;
