import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import OrderStatusUpdater from "@/components/admin/OrderStatusUpdater";
import ShipmentActions from "@/components/admin/ShipmentActions";
import { getOrderById, PII_ERASED_SENTINEL } from "@/lib/services/order";
import GdprEraseButton from "@/components/admin/GdprEraseButton";
import type { OrderStatus } from "@/lib/generated/prisma/client";
import { describeShipping } from "@/lib/shipping/display";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Függőben",
  PAID: "Fizetve",
  IN_PRODUCTION: "Gyártásban",
  SHIPPED: "Kiszállítva",
  COMPLETE: "Teljesítve",
  RETURNED: "Visszaküldve",
  CANCELLED: "Törölve",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-blue-100 text-blue-800",
  IN_PRODUCTION: "bg-purple-100 text-purple-800",
  SHIPPED: "bg-orange-100 text-orange-800",
  COMPLETE: "bg-green-100 text-green-800",
  RETURNED: "bg-red-100 text-red-800",
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
    for (const obj of json[side] ?? []) {
      const o = obj as { type?: string; src?: string };
      // Fabric v7 serializes as "Image" (capital I); older versions used "image".
      // Normalise before comparing.
      const typeKey = (o.type ?? "").toLowerCase();
      if (
        typeKey === "image" &&
        typeof o.src === "string" &&
        o.src.includes("/uploads/")
      ) {
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
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Feltöltött képek
      </h2>
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
  const rows: {
    side: string;
    type: string;
    xCm: number;
    yCm: number;
    wCm: number;
    hCm: number;
  }[] = [];

  for (const [side, label] of [
    ["front", "Elől"],
    ["back", "Hátul"],
  ] as const) {
    const objects = json[side] ?? [];
    for (const obj of objects) {
      const o = obj as DesignObject;
      if (o._xCm === undefined) continue; // old design without coordinate metadata
      rows.push({
        side: label,
        type: o.type === "i-text" ? "Szöveg" : "Kép",
        xCm: o._xCm,
        yCm: o._yCm ?? 0,
        wCm: o._wCm ?? 0,
        hCm: o._hCm ?? 0,
      });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Terv koordinátái
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-gray-500">
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
  const shipping = describeShipping(order);

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
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            ← Rendelések
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-sm text-gray-600">{order.id}</span>
        </div>

        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Rendelés részletek
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {new Date(order.createdAt).toLocaleString("hu-HU")}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[order.status]}`}
          >
            {STATUS_LABELS[order.status]}
          </span>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Customer info */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Vevő adatai
            </h2>
            {piiErased ? (
              <p className="text-sm italic text-gray-400">
                Személyes adatok törölve.
              </p>
            ) : (
              <dl className="space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-gray-500">Név:</dt>
                  <dd className="text-gray-900">{order.customerName}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-gray-500">Email:</dt>
                  <dd className="text-gray-900">{order.customerEmail}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-gray-500">Cím:</dt>
                  <dd className="text-gray-900">
                    {address!.postalCode} {address!.city}, {address!.address}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-gray-500">Ország:</dt>
                  <dd className="text-gray-900">{address!.country}</dd>
                </div>
              </dl>
            )}
            {!piiErased && <GdprEraseButton orderId={order.id} />}
          </div>

          {/* Order info */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Rendelés adatai
            </h2>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-gray-500">Termék:</dt>
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
                <dt className="w-24 shrink-0 text-gray-500">Szín:</dt>
                <dd className="text-gray-900">{order.colorName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-gray-500">Méret:</dt>
                <dd className="text-gray-900">{order.sizeName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-gray-500">Összeg:</dt>
                <dd className="font-medium text-gray-900">
                  {order.totalAmount.toLocaleString("hu-HU")} Ft
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-gray-500">Stripe:</dt>
                <dd className="break-all font-mono text-xs text-gray-600">
                  {order.stripeSessionId}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Shipping info */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Szállítás
          </h2>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-gray-500">Módszer:</dt>
              <dd className="text-gray-900">{shipping.methodLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-gray-500">Szállítási díj:</dt>
              <dd className="text-gray-900">
                {order.shippingCost.toLocaleString("hu-HU")} Ft
              </dd>
            </div>
            {shipping.isDeliveryPoint && shipping.pointName && (
              <>
                <div className="flex gap-2">
                  <dt className="w-36 shrink-0 text-gray-500">
                    Átvételi pont:
                  </dt>
                  <dd className="text-gray-900">{shipping.pointName}</dd>
                </div>
                {(order.deliveryPointId ?? order.pickupPointId) && (
                  <div className="flex gap-2">
                    <dt className="w-36 shrink-0 text-gray-500">Pont kód:</dt>
                    <dd className="font-mono text-xs text-gray-600">
                      {order.deliveryPointId ?? order.pickupPointId}
                    </dd>
                  </div>
                )}
                {shipping.pointAddress && (
                  <div className="flex gap-2">
                    <dt className="w-36 shrink-0 text-gray-500">Pont cím:</dt>
                    <dd className="text-gray-900">{shipping.pointAddress}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
          {order.deliveryType && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <ShipmentActions
                orderId={order.id}
                kvikkTrackingNumber={order.kvikkTrackingNumber}
                courierTrackingNumber={order.courierTrackingNumber}
              />
            </div>
          )}
        </div>

        {/* Design preview */}
        {order.design?.svgUrl && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Egyedi terv
            </h2>
            <object
              data={order.design.svgUrl}
              type="image/svg+xml"
              className="max-w-full rounded border border-gray-200"
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
              <span className="text-sm text-gray-500">
                Az SVG nem tölthető be.
              </span>
            </object>
            <a
              href={order.design.svgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
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
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Állapot módosítása
          </h2>
          <OrderStatusUpdater orderId={order.id} currentStatus={order.status} />
        </div>
      </main>
    </div>
  );
}
