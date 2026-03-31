import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import { getAllOrders } from "@/lib/services/order";
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

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  return (
    <div>
      <AdminNav />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Rendelések</h1>

        {orders.length === 0 ? (
          <p className="text-gray-500">Még nincs rendelés.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-64">Azonosító</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-40">Vevő</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-72">Termék</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">Összeg</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Állapot</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">Dátum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {order.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{order.customerName}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {order.variant.product.name} — {order.variant.color} / {order.variant.size}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {order.totalAmount.toLocaleString("hu-HU")} Ft
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString("hu-HU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
