import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import OrderStatusUpdater from "@/components/admin/OrderStatusUpdater";
import { getOrderById } from "@/lib/services/order";
import type { OrderStatus } from "@/lib/generated/prisma/client";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Függőben",
  PAID: "Fizetve",
  IN_PRODUCTION: "Gyártásban",
  SHIPPED: "Kiszállítva",
  COMPLETE: "Teljesítve",
  CANCELLED: "Törölve",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-blue-100 text-blue-800",
  IN_PRODUCTION: "bg-purple-100 text-purple-800",
  SHIPPED: "bg-orange-100 text-orange-800",
  COMPLETE: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const order = await getOrderById(params.id);
  if (!order) notFound();

  const address = order.shippingAddress as {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };

  return (
    <div>
      <AdminNav />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin/orders"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Rendelések
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-sm text-gray-600">{order.id}</span>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Rendelés részletek</h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(order.createdAt).toLocaleString("hu-HU")}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Customer info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Vevő adatai</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Név:</dt>
                <dd className="text-gray-900">{order.customerName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Email:</dt>
                <dd className="text-gray-900">{order.customerEmail}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Cím:</dt>
                <dd className="text-gray-900">
                  {address.postalCode} {address.city}, {address.address}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Ország:</dt>
                <dd className="text-gray-900">{address.country}</dd>
              </div>
            </dl>
          </div>

          {/* Order info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Rendelés adatai</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Termék:</dt>
                <dd className="text-gray-900">{order.variant.product.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Szín:</dt>
                <dd className="text-gray-900">{order.variant.color}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Méret:</dt>
                <dd className="text-gray-900">{order.variant.size}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Összeg:</dt>
                <dd className="text-gray-900 font-medium">
                  {order.totalAmount.toLocaleString("hu-HU")} Ft
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Stripe:</dt>
                <dd className="font-mono text-xs text-gray-600 break-all">{order.stripeSessionId}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Design preview */}
        {order.design?.svgUrl && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Egyedi terv</h2>
            <object
              data={order.design.svgUrl}
              type="image/svg+xml"
              className="max-w-full border border-gray-100 rounded"
            >
              <span className="text-sm text-gray-500">Az SVG nem tölthető be.</span>
            </object>
            <a
              href={order.design.svgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm text-blue-600 hover:underline"
            >
              Megnyitás új lapon
            </a>
          </div>
        )}

        {/* Status update */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Állapot módosítása</h2>
          <OrderStatusUpdater orderId={order.id} currentStatus={order.status} />
        </div>
      </main>
    </div>
  );
}
