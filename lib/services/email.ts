import { Resend } from "resend";
import { render } from "@react-email/components";
import OrderConfirmation from "@/emails/OrderConfirmation";
import ShipmentNotification from "@/emails/ShipmentNotification";
import PickupReady from "@/emails/PickupReady";
import OrderFormReceived from "@/emails/OrderFormReceived";
import OrderFormNotification from "@/emails/OrderFormNotification";
import OrderNotification from "@/emails/OrderNotification";
import { formatHuf } from "@/lib/utils/format";
import { getShopSettings } from "@/lib/services/shopSettings";
import { describeShipping } from "@/lib/shipping/display";
import type {
  DeliveryType,
  ShippingMethod,
} from "@/lib/generated/prisma/client";

const FROM_ADDRESS = "Varázskép <rendeles@varazskep.hu>";

// Where the shop is notified about new orders — admin-editable (Beállítások page).
async function shopNotificationAddress(): Promise<string> {
  return (await getShopSettings()).notificationEmail;
}

function adminOrderUrl(orderId: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/admin/orders/${orderId}`;
}

interface OrderFormEmailInput {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  note: string;
  items: {
    productName: string;
    colorName: string;
    sizeName: string;
    quantity: number;
  }[];
  attachmentNames: string[];
}

function describeOrderFormItems(items: OrderFormEmailInput["items"]) {
  return items.map((item) => ({
    description: `${item.productName} – ${item.colorName}, ${item.sizeName}`,
    quantity: item.quantity,
  }));
}

// Confirmation to the customer after an order form submission.
export async function sendOrderFormReceivedEmail(
  input: OrderFormEmailInput
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const html = await render(
    OrderFormReceived({
      customerName: input.customerName,
      orderId: input.orderId,
      items: describeOrderFormItems(input.items),
      note: input.note,
      attachmentNames: input.attachmentNames,
    })
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.customerEmail,
    subject: "Megrendelésed megérkezett – Varázskép",
    html,
  });
}

// Notification to the shop about a new order form order. Reply-To is the customer, so
// answering the email reaches them directly.
export async function sendOrderFormNotificationEmail(
  input: OrderFormEmailInput
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const html = await render(
    OrderFormNotification({
      orderId: input.orderId,
      adminUrl: adminOrderUrl(input.orderId),
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      items: describeOrderFormItems(input.items),
      note: input.note,
      attachmentNames: input.attachmentNames,
    })
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: await shopNotificationAddress(),
    replyTo: input.customerEmail,
    subject: `Új megrendelés (megrendelő lap) – ${input.customerName}`,
    html,
  });
}

// A paid webshop order — the input of both the customer confirmation and the shop
// notification sent from the Stripe webhook.
interface PaidOrderEmailInput {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  items: {
    productName: string;
    colorName: string;
    sizeName: string;
    quantity: number;
    // Nullable in the schema for ORDER_FORM lines; always set on paid webshop orders.
    unitPriceHuf: number | null;
    printFeeHuf: number | null; // per piece
  }[];
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

function describePaidItems(items: PaidOrderEmailInput["items"]) {
  return items.map((item) => ({
    description: `${item.productName} – ${item.colorName}, ${item.sizeName}`,
    quantity: item.quantity,
    withPrint: (item.printFeeHuf ?? 0) > 0,
    lineTotal: formatHuf(
      ((item.unitPriceHuf ?? 0) + (item.printFeeHuf ?? 0)) * item.quantity
    ),
  }));
}

function describePaidShipping(input: PaidOrderEmailInput) {
  return describeShipping({
    shippingCourier: input.shippingCourier,
    deliveryType: input.deliveryType,
    pickupPointName: input.pickupPointName ?? null,
    pickupPointAddress: input.pickupPointAddress ?? null,
    shippingMethod: input.shippingMethod,
  });
}

export async function sendOrderConfirmationEmail(
  input: PaidOrderEmailInput
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const shipping = describePaidShipping(input);

  const html = await render(
    OrderConfirmation({
      customerName: input.customerName,
      orderId: input.orderId,
      items: describePaidItems(input.items),
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

// Notification to the shop about a new paid webshop order. Reply-To is the customer, so
// answering the email reaches them directly.
export async function sendOrderNotificationEmail(
  input: PaidOrderEmailInput
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const shipping = describePaidShipping(input);
  const { address, city, postalCode } = input.shippingAddress;
  const destination =
    shipping.isDeliveryPoint && shipping.pointName
      ? [shipping.pointName, shipping.pointAddress].filter(Boolean).join("\n")
      : `${postalCode} ${city}, ${address}`;
  const totalAmount = formatHuf(input.totalAmount);

  const html = await render(
    OrderNotification({
      orderId: input.orderId,
      adminUrl: adminOrderUrl(input.orderId),
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      items: describePaidItems(input.items),
      totalAmount,
      methodLabel: shipping.methodLabel,
      shippingCost: formatHuf(input.shippingCost),
      destination,
    })
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: await shopNotificationAddress(),
    replyTo: input.customerEmail,
    subject: `Új rendelés (webshop) – ${input.customerName}, ${totalAmount}`,
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

interface SendPickupReadyInput {
  customerName: string;
  customerEmail: string;
  courierLabel: string; // e.g. "Packeta", "Foxpost"
  pointName?: string; // pickup point display name
  pointAddress?: string; // pickup point address
  trackingNumber: string;
  trackingLink: string;
}

// "Your package is ready to collect at the point" email — sent for delivery-point orders
// when the parcel first reaches the pickup point (Kvikk `ready_for_pickup` stage).
export async function sendPickupReadyEmail(
  input: SendPickupReadyInput
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  const html = await render(
    PickupReady({
      customerName: input.customerName,
      courierLabel: input.courierLabel,
      pointName: input.pointName,
      pointAddress: input.pointAddress,
      trackingNumber: input.trackingNumber,
      trackingLink: input.trackingLink,
    })
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.customerEmail,
    subject: "Csomagod átvehető – Varázskép",
    html,
  });
}
