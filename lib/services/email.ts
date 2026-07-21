import { Resend } from "resend";
import { render } from "@react-email/components";
import OrderConfirmation from "@/emails/OrderConfirmation";
import ShipmentNotification from "@/emails/ShipmentNotification";
import { formatHuf } from "@/lib/utils/format";
import { describeShipping } from "@/lib/shipping/display";
import type {
  DeliveryType,
  ShippingMethod,
} from "@/lib/generated/prisma/client";

const FROM_ADDRESS = "Varázskép <rendeles@varazskep.hu>";

interface SendOrderConfirmationInput {
  orderId: string;
  customerName: string;
  customerEmail: string;
  productName: string;
  variantColor: string;
  variantSize: string;
  totalAmount: number; // HUF integer
  shippingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  shippingCost: number;
  // Shipping description inputs (new Kvikk fields + legacy fallback).
  shippingCourier: string | null;
  deliveryType: DeliveryType | null;
  shippingMethod: ShippingMethod;
  pickupPointName?: string | null;
  pickupPointAddress?: string | null;
}

export async function sendOrderConfirmationEmail(
  input: SendOrderConfirmationInput
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const shipping = describeShipping({
    shippingCourier: input.shippingCourier,
    deliveryType: input.deliveryType,
    pickupPointName: input.pickupPointName ?? null,
    pickupPointAddress: input.pickupPointAddress ?? null,
    shippingMethod: input.shippingMethod,
  });

  const html = await render(
    OrderConfirmation({
      customerName: input.customerName,
      orderId: input.orderId,
      productName: input.productName,
      variantColor: input.variantColor,
      variantSize: input.variantSize,
      totalAmount: formatHuf(input.totalAmount),
      shippingAddress: {
        address: input.shippingAddress.address,
        city: input.shippingAddress.city,
        postalCode: input.shippingAddress.postalCode,
      },
      methodLabel: shipping.methodLabel,
      shippingCost: formatHuf(input.shippingCost),
      isDeliveryPoint: shipping.isDeliveryPoint,
      pointName: shipping.pointName,
      pointAddress: shipping.pointAddress,
    })
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.customerEmail,
    subject: "Rendelésed megérkezett – Varázskép",
    html,
  });
}

interface SendShipmentNotificationInput {
  customerName: string;
  customerEmail: string;
  courierLabel: string; // e.g. "MPL", "GLS"
  trackingNumber: string;
  trackingLink: string;
}

// "Your package is on its way" email — sent when a shipment first reaches SHIPPED.
export async function sendShipmentNotificationEmail(
  input: SendShipmentNotificationInput
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const html = await render(
    ShipmentNotification({
      customerName: input.customerName,
      courierLabel: input.courierLabel,
      trackingNumber: input.trackingNumber,
      trackingLink: input.trackingLink,
    })
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.customerEmail,
    subject: "Csomagod úton van – Varázskép",
    html,
  });
}
