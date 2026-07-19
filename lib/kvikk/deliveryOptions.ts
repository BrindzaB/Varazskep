// The customer-facing delivery options we offer (HU), as approved for Phase 8.
// Home delivery = a courier radio choice; delivery points = shown together on the Kvikk
// Map widget. `mapType` is the Kvikk Map widget's SHORT type code (widget `couriers[].type`);
// convert it to the create-shipment `deliveryPointType` with lib/kvikk/deliveryPointMap.ts.

import type { KvikkCourier } from "./types";

export interface HomeDeliveryOption {
  courier: KvikkCourier;
  label: string;
}

export interface PointDeliveryOption {
  courier: KvikkCourier;
  mapType: string; // Kvikk Map widget short type code
  label: string;
}

export const HOME_DELIVERY_OPTIONS: HomeDeliveryOption[] = [
  { courier: "mpl", label: "MPL házhozszállítás" },
  { courier: "gls", label: "GLS házhozszállítás" },
];

export const POINT_DELIVERY_OPTIONS: PointDeliveryOption[] = [
  { courier: "foxpost", mapType: "foxpost", label: "Foxpost automata" },
  { courier: "packeta", mapType: "zbox", label: "Packeta Z-Box" },
  { courier: "mpl", mapType: "automata", label: "MPL automata" },
  { courier: "gls", mapType: "locker", label: "GLS automata" },
  { courier: "gls", mapType: "shop", label: "GLS csomagpont" },
  { courier: "dpd", mapType: "parcelshop", label: "DPD csomagpont" },
];
