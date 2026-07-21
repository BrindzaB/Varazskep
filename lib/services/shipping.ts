// Shipping-related business logic. DB + Malfini access lives here (service layer) so the
// pure weight helpers in lib/kvikk/weight.ts stay side-effect free and unit-testable.

import { prisma } from "@/lib/db";
import { getNomenclatureGrossWeightKg } from "@/lib/malfini/client";
import {
  DEFAULT_PARCEL_WEIGHT_GRAMS,
  resolveWeightGrams,
} from "@/lib/kvikk/weight";
import { createShipment, createDeliveryNote } from "@/lib/kvikk/client";
import { getSenderId } from "@/lib/kvikk/account";
import { setOrderShipment, markOrdersDispatched } from "@/lib/services/order";
import type {
  CreateDeliveryNoteData,
  CreateShipmentRequest,
  KvikkCourier,
  KvikkDeliveryPointType,
} from "@/lib/kvikk/types";

// Identifies the ordered item, mirroring the two product sources in the cart/order.
export type ParcelWeightInput =
  | { source: "local"; variantId: string }
  | { source: "malfini"; productCode: string; productSizeCode: string };

// Resolves the Kvikk parcel weight (grams) for an ordered item:
//   - local products: the stored Variant.weightGrams,
//   - Malfini products: the per-size gross weight from the cached catalog,
// falling back to DEFAULT_PARCEL_WEIGHT_GRAMS when neither is available.
export async function resolveParcelWeightGrams(
  item: ParcelWeightInput
): Promise<number> {
  if (item.source === "local") {
    const variant = await prisma.variant.findUnique({
      where: { id: item.variantId },
      select: { weightGrams: true },
    });
    return resolveWeightGrams({ storedGrams: variant?.weightGrams ?? null });
  }

  const grossWeightKg = await getNomenclatureGrossWeightKg(
    item.productCode,
    item.productSizeCode
  );
  return resolveWeightGrams({ grossWeightKg });
}

// Extracts the Kvikk shipment id from the app link (".../shipments/<id>").
function extractShipmentId(link: string): string | undefined {
  const match = /\/shipments\/([^/?#]+)/.exec(link ?? "");
  return match?.[1];
}

export interface CreateShipmentResult {
  trackingNumber: string;
  courierTrackingNumber: string;
  alreadyExisted: boolean;
}

// Creates the Kvikk shipment + label for an order — the admin action performed when the
// product is ready. Idempotent (returns the existing tracking number if already created).
// Throws if the order is not a Kvikk order, or on a Kvikk API error (the caller surfaces it).
export async function createShipmentForOrder(
  orderId: string
): Promise<CreateShipmentResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  if (order.kvikkTrackingNumber) {
    return {
      trackingNumber: order.kvikkTrackingNumber,
      courierTrackingNumber: order.courierTrackingNumber ?? "",
      alreadyExisted: true,
    };
  }
  if (!order.shippingCourier || !order.deliveryType) {
    throw new Error("Order has no Kvikk shipping details (legacy order).");
  }

  const senderID = await getSenderId();
  const address = order.shippingAddress as {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  const goodsValue = Math.max(0, order.totalAmount - order.shippingCost);
  const weightGrams = order.parcelWeightGrams ?? DEFAULT_PARCEL_WEIGHT_GRAMS;

  const req: CreateShipmentRequest = {
    name: order.customerName,
    phone: order.customerPhone ?? "",
    email: order.customerEmail,
    // shippingCourier is one of our validated option slugs.
    courier: order.shippingCourier as KvikkCourier,
    orderID: order.id,
    parcels: [{ weight: weightGrams, value: goodsValue }],
    cod: 0,
    senderID,
    ...(order.deliveryType === "DELIVERY_POINT"
      ? {
          // deliveryPointType was validated against the account's point types at checkout.
          deliveryPointType: (order.deliveryPointType ??
            "") as KvikkDeliveryPointType,
          deliveryPointID: order.deliveryPointId ?? "",
        }
      : {
          address: address.address,
          city: address.city,
          postcode: address.postalCode,
          country: address.country,
        }),
  };

  const shipment = await createShipment(req);
  const shipmentId = extractShipmentId(shipment.link);
  await setOrderShipment(order.id, {
    kvikkTrackingNumber: shipment.trackingNumber,
    courierTrackingNumber: shipment.courierTrackingNumber,
    ...(shipmentId ? { kvikkShipmentId: shipmentId } : {}),
  });

  return {
    trackingNumber: shipment.trackingNumber,
    courierTrackingNumber: shipment.courierTrackingNumber,
    alreadyExisted: false,
  };
}

// Creates a delivery note (courier pickup manifest / drop-off form) for a batch of
// shipments, then marks the successfully-processed orders as dispatched so they are not
// offered again. Kvikk validates the pickup date (working day / blacklist rules) and
// returns 400 on an invalid date — the caller surfaces that error.
export async function createDeliveryNoteForShipments(input: {
  pickupDate: string;
  pickupFor: KvikkCourier[];
  shipments: string[];
}): Promise<CreateDeliveryNoteData> {
  const data = await createDeliveryNote({
    pickupDate: input.pickupDate,
    pickupFor: input.pickupFor,
    shipments: input.shipments,
  });
  if (data.successfulShipments.length > 0 && data.deliveryNote?._id) {
    await markOrdersDispatched(data.successfulShipments, data.deliveryNote._id);
  }
  return data;
}
