// Maps a Map-widget / points-api point (courier + SHORT type code, e.g. "packeta" + "zbox")
// to the LONG deliveryPointType code that POST /shipment expects (e.g. "packeta_zbox").
//
// The Map widget callback and GET/webhook responses use short type codes; the create-shipment
// endpoint uses {courier}_{type} codes. This table bridges the two.
//
// All target slugs verified against GET /account-details
// (couriers[].deliveryPointTypes[].slug), 2026-07 — including "foxpost_foxpost"
// (the docs' "foxost_foxpost" was indeed a typo).

import type { KvikkCourier, KvikkDeliveryPointType } from "./types";

// courier → (short map type code → long deliveryPointType).
// famafutar has no delivery points (home-delivery courier) and is intentionally absent.
const DELIVERY_POINT_TYPES: Record<
  KvikkCourier,
  Partial<Record<string, KvikkDeliveryPointType>>
> = {
  mpl: {
    posta: "mpl_posta",
    postapont: "mpl_postapont",
    automata: "mpl_automata",
  },
  foxpost: {
    foxpost: "foxpost_foxpost",
    zbox: "foxpost_zbox",
    zpont: "foxpost_zpont",
  },
  packeta: {
    zbox: "packeta_zbox",
    zpont: "packeta_zpont",
    foxpost: "packeta_foxpost",
  },
  gls: {
    locker: "gls_locker",
    shop: "gls_shop",
  },
  dpd: {
    alzabox: "dpd_alzabox",
    parcelshop: "dpd_parcelshop",
  },
  famafutar: {},
};

// Returns the long deliveryPointType for a (courier, short type) pair, or null if the
// combination is unknown/unsupported. Callers should treat null as "not shippable to
// this point" and surface a validation error.
export function toDeliveryPointType(
  courier: string,
  mapType: string
): KvikkDeliveryPointType | null {
  const byCourier = DELIVERY_POINT_TYPES[courier as KvikkCourier];
  return byCourier?.[mapType] ?? null;
}
