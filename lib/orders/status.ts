import type { OrderChannel, OrderStatus } from "@/lib/generated/prisma/client";

// Admin display labels and badge colours for order statuses and channels.

export const STATUS_LABELS: Record<OrderStatus, string> = {
  REQUESTED: "Beérkezett",
  PENDING: "Függőben",
  PAID: "Fizetve",
  IN_PRODUCTION: "Gyártásban",
  SHIPPED: "Kiszállítva",
  COMPLETE: "Teljesítve",
  RETURNED: "Visszaküldve",
  CANCELLED: "Törölve",
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  REQUESTED: "bg-sky-100 text-sky-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-blue-100 text-blue-800",
  IN_PRODUCTION: "bg-purple-100 text-purple-800",
  SHIPPED: "bg-orange-100 text-orange-800",
  COMPLETE: "bg-green-100 text-green-800",
  RETURNED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  WEBSHOP: "Webshop",
  ORDER_FORM: "Megrendelő lap",
};
