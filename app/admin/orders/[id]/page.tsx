import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import OrderStatusUpdater from "@/components/admin/OrderStatusUpdater";
import { getOrderById, PII_ERASED_SENTINEL } from "@/lib/services/order";
import GdprEraseButton from "@/components/admin/GdprEraseButton";
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

// ── Design coordinates table ──────────────────────────────────────────────────

interface DesignObject {
  type?: string;
  _xCm?: number;
  _yCm?: number;
  _wCm?: number;
  _hCm?: number;
}

// Extracts URLs of customer-uploaded images from canvasJson.
// Uploaded images are stored under the "uploads/" path prefix in the designs bucket.
function extractCustomerUploadUrls(canvasJson: unknown): string[] {
  const json = canvasJson as { front?: unknown[]; back?: unknown[] };
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const side of ["front", "back"] as const) {
    for (const obj of (json[side] ?? [])) {
      const o = obj as { type?: string; src?: string };
      if (o.type === "image" && typeof o.src === "string" && o.src.includes("/uploads/")) {
        if (!seen.has(o.src)) {
          seen.add(o.src);
          urls.push(o.src);
        }
      }
    }
  }
  return urls;
}

function CustomerUploadedImages({ canvasJson }: { canvasJson: unknown }) {
  const urls = extractCustomerUploadUrls(canvasJson);
  if (urls.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Feltöltött képek</h2>
      <div className="flex flex-wrap gap-4">
        {urls.map((url, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Feltöltött kép ${i + 1}`}
              className="h-20 w-20 rounded border border-gray-200 object-contain"
            />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="text-xs text-blue-600 hover:underline"
            >
              Letöltés
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesignCoordinatesTable({ canvasJson }: { canvasJson: unknown }) {
  const json = canvasJson as { front?: unknown[]; back?: unknown[] };
  const rows: { side: string; type: string; xCm: number; yCm: number; wCm: number; hCm: number }[] = [];

  for (const [side, label] of [["front", "Elől"], ["back", "Hátul"]] as const) {
    const objects = json[side] ?? [];
    for (const obj of objects) {
      const o = obj as DesignObject;
      if (o._xCm === undefined) continue; // old design without coordinate metadata
      rows.push({
        side: label,
        type: o.type === "i-text" ? "Szöveg" : "Kép",
        xCm:  o._xCm,
        yCm:  o._yCm ?? 0,
        wCm:  o._wCm ?? 0,
        hCm:  o._hCm ?? 0,
      });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Terv koordinátái</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="pb-2 font-medium">Oldal</th>
            <th className="pb-2 font-medium">Típus</th>
            <th className="pb-2 font-medium">X</th>
            <th className="pb-2 font-medium">Y</th>
            <th className="pb-2 font-medium">Szélesség</th>
            <th className="pb-2 font-medium">Magasság</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0">
              <td className="py-1.5 text-gray-900">{row.side}</td>
              <td className="py-1.5 text-gray-900">{row.type}</td>
              <td className="py-1.5 text-gray-600">{row.xCm.toFixed(2)} cm</td>
              <td className="py-1.5 text-gray-600">{row.yCm.toFixed(2)} cm</td>
              <td className="py-1.5 text-gray-600">{row.wCm.toFixed(2)} cm</td>
              <td className="py-1.5 text-gray-600">{row.hCm.toFixed(2)} cm</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const order = await getOrderById(params.id);
  if (!order) notFound();

  const piiErased = order.customerName === PII_ERASED_SENTINEL;

  const address = piiErased
    ? null
    : (order.shippingAddress as {
        address: string;
        city: string;
        postalCode: string;
        country: string;
      });

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
            {piiErased ? (
              <p className="text-sm text-gray-400 italic">Személyes adatok törölve.</p>
            ) : (
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
                    {address!.postalCode} {address!.city}, {address!.address}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">Ország:</dt>
                  <dd className="text-gray-900">{address!.country}</dd>
                </div>
              </dl>
            )}
            {!piiErased && <GdprEraseButton orderId={order.id} />}
          </div>

          {/* Order info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Rendelés adatai</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Termék:</dt>
                <dd className="text-gray-900">
                  {order.productName}
                  {order.productCode && (
                    <span className="ml-2 font-mono text-xs text-gray-500">
                      {order.productCode}
                      {order.productSizeCode && ` · ${order.productSizeCode}`}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Szín:</dt>
                <dd className="text-gray-900">{order.colorName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">Méret:</dt>
                <dd className="text-gray-900">{order.sizeName}</dd>
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
              className="max-w-full border border-gray-200 rounded"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #d1d5db 25%, transparent 25%)," +
                  "linear-gradient(-45deg, #d1d5db 25%, transparent 25%)," +
                  "linear-gradient(45deg, transparent 75%, #d1d5db 75%)," +
                  "linear-gradient(-45deg, transparent 75%, #d1d5db 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                backgroundColor: "#f3f4f6",
              }}
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

        {/* Customer uploaded images — extracted from canvasJson */}
        {order.design?.canvasJson && (
          <CustomerUploadedImages canvasJson={order.design.canvasJson} />
        )}

        {/* Design coordinates — parsed from canvasJson */}
        {order.design?.canvasJson && (
          <DesignCoordinatesTable canvasJson={order.design.canvasJson} />
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
