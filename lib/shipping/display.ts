// Human-readable shipping description for an order, covering BOTH the new Kvikk fields
// (shippingCourier + deliveryType) and legacy orders (shippingMethod) via a fallback.
// Used by the confirmation email, the order success page, and the admin order detail so
// they all render shipping consistently.

import type {
  DeliveryType,
  ShippingMethod,
} from "@/lib/generated/prisma/client";
import { SHIPPING_LABELS } from "@/lib/shipping/config";

// Courier slug → display name.
export const COURIER_LABELS: Record<string, string> = {
  mpl: "MPL",
  foxpost: "Foxpost",
  packeta: "Packeta",
  gls: "GLS",
  dpd: "DPD",
  famafutar: "FámaFutár",
};

export interface ShippingDisplay {
  methodLabel: string; // e.g. "GLS átvételi pont", "MPL házhozszállítás"
  isDeliveryPoint: boolean;
  pointName?: string;
  pointAddress?: string;
}

// The order fields this helper reads (new Kvikk fields + legacy fallback).
export interface ShippingDisplayInput {
  shippingCourier: string | null;
  deliveryType: DeliveryType | null;
  pickupPointName: string | null;
  pickupPointAddress: string | null;
  shippingMethod: ShippingMethod; // legacy fallback (always present)
}

export function describeShipping(o: ShippingDisplayInput): ShippingDisplay {
  // New Kvikk order.
  if (o.deliveryType) {
    const courier = o.shippingCourier
      ? (COURIER_LABELS[o.shippingCourier] ?? o.shippingCourier)
      : "";
    const isDeliveryPoint = o.deliveryType === "DELIVERY_POINT";
    const typeLabel = isDeliveryPoint ? "átvételi pont" : "házhozszállítás";
    return {
      methodLabel: `${courier} ${typeLabel}`.trim(),
      isDeliveryPoint,
      pointName: isDeliveryPoint ? (o.pickupPointName ?? undefined) : undefined,
      pointAddress: isDeliveryPoint
        ? (o.pickupPointAddress ?? undefined)
        : undefined,
    };
  }

  // Legacy order (created before the Kvikk migration).
  const isDeliveryPoint = o.shippingMethod === "FOXPOST_LOCKER";
  return {
    methodLabel: SHIPPING_LABELS[o.shippingMethod],
    isDeliveryPoint,
    pointName: isDeliveryPoint ? (o.pickupPointName ?? undefined) : undefined,
    pointAddress: isDeliveryPoint
      ? (o.pickupPointAddress ?? undefined)
      : undefined,
  };
}
