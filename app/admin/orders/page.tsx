import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import { getAllOrders } from "@/lib/services/order";
import { getOrderLines, summarizeOrderLines } from "@/lib/orders/lines";
import { CHANNEL_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/orders/status";
import type { OrderChannel } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

const CHANNEL_FILTERS: { label: string; value: OrderChannel | null }[] = [
  { label: "Összes", value: null },
  { label: "Webshop", value: "WEBSHOP" },
  { label: "Megrendelő lap", value: "ORDER_FORM" },
];

function parseChannel(raw: string | undefined): OrderChannel | null {
  return raw === "WEBSHOP" || raw === "ORDER_FORM" ? raw : null;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { channel?: string };
}) {
  const channel = parseChannel(searchParams.channel);
  const orders = await getAllOrders(channel ?? undefined);

  return (
    <div>
      <AdminNav />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Rendelések</h1>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {CHANNEL_FILTERS.map((f) => (
            <Link
              key={f.label}
              href={f.value ? `/admin/orders?channel=${f.value}` : "/admin/orders"}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                channel === f.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

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
                      {order.channel === "ORDER_FORM" && (
                        <span className="mr-2 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                          {CHANNEL_LABELS.ORDER_FORM}
                        </span>
                      )}
                      {summarizeOrderLines(getOrderLines(order)) || "Lásd a megrendelés szövegét"}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {order.totalAmount !== null
                        ? `${order.totalAmount.toLocaleString("hu-HU")} Ft`
                        : "Egyeztetendő"}
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
