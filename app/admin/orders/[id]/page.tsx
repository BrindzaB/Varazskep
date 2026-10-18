import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import OrderStatusUpdater from "@/components/admin/OrderStatusUpdater";
import ShipmentActions from "@/components/admin/ShipmentActions";
import OrderPhoneEditor from "@/components/admin/OrderPhoneEditor";
import { getOrderById, PII_ERASED_SENTINEL } from "@/lib/services/order";
import { getDesignSvgSize, type CanvasJson } from "@/lib/services/design";
import GdprEraseButton from "@/components/admin/GdprEraseButton";
import { describeShipping } from "@/lib/shipping/display";
import { getOrderLines, type OrderLine } from "@/lib/orders/lines";
import { CHANNEL_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/lib/orders/status";

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
      <div className="overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
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
    </div>
  );
}

function OrderLinesTable({
  lines,
  showPrices,
}: {
  lines: OrderLine[];
  showPrices: boolean; // ORDER_FORM lines have no price — the shop prices them later
}) {
  if (lines.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Tételek</h2>
        <p className="text-sm text-gray-500">
          Nincs kiválasztott termék — lásd a megrendelés szövegét.
        </p>
      </div>
    );
  }
  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Tételek</h2>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="pb-2 font-medium">Termék</th>
              <th className="pb-2 font-medium">Szín</th>
              <th className="pb-2 font-medium">Méret</th>
              <th className="pb-2 text-right font-medium">Db</th>
              {showPrices && (
                <>
                  <th className="pb-2 text-right font-medium">Egységár</th>
                  <th className="pb-2 text-right font-medium">
                    Nyomtatás / db
                  </th>
                  <th className="pb-2 text-right font-medium">Összesen</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr
                key={line.key}
                className="border-b border-gray-50 last:border-0"
              >
                <td className="py-1.5 text-gray-900">
                  {line.productName}
                  {line.productCode && (
                    <span className="ml-2 font-mono text-xs text-gray-500">
                      {line.productCode}
                      {line.productSizeCode && ` · ${line.productSizeCode}`}
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-gray-900">{line.colorName}</td>
                <td className="py-1.5 text-gray-900">{line.sizeName}</td>
                <td className="py-1.5 text-right text-gray-900">
                  {line.quantity ?? "—"}
                </td>
                {showPrices && (
                  <>
                    <td className="py-1.5 text-right text-gray-600">
                      {formatHufOrDash(line.unitPriceHuf)}
                    </td>
                    <td className="py-1.5 text-right text-gray-600">
                      {formatHufOrDash(line.printFeeHuf)}
                    </td>
                    <td className="py-1.5 text-right font-medium text-gray-900">
                      {line.quantity !== null &&
                      line.unitPriceHuf !== null &&
                      line.printFeeHuf !== null
                        ? formatHufOrDash(
                            (line.unitPriceHuf + line.printFeeHuf) *
                              line.quantity,
                          )
                        : "—"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lines.some((l) => l.quantity === null) && (
        <p className="mt-3 text-xs text-gray-500">
          Régi rendelés: a darabszám és a tételár nem lett eltárolva, és ha a
          kosárban több termék volt, csak az első látszik. A pontos tartalom a
          Stripe-ban ellenőrizhető.
        </p>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatHufOrDash(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString("hu-HU")} Ft`;
}

// Design preview. Served via our own route (Content-Disposition: inline) rather than
// the Supabase public URL, which now forces an attachment download for SVGs.
function DesignPreview({
  orderId,
  designId,
  canvasJson,
  previewUrl,
  title,
}: {
  orderId: string;
  designId: string;
  canvasJson: unknown;
  previewUrl: string | null;
  title: string;
}) {
  // Size the design preview to the design's real aspect ratio (portrait for
  // shirts, wide for mugs, square for pillows) instead of a fixed <object> box.
  const svgSize = getDesignSvgSize(canvasJson as CanvasJson);
  const fit = Math.min(420 / svgSize.width, 460 / svgSize.height, 1.5);
  const box = {
    width: Math.round(svgSize.width * fit),
    height: Math.round(svgSize.height * fit),
  };
  const svgUrl = `/api/admin/orders/${orderId}/design?designId=${designId}`;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">{title}</h2>
      <div className="flex flex-wrap items-start gap-6">
        {/* Composite — the product with the design, as the customer saw it */}
        {previewUrl && (
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">
              Ahogy a vevő látta
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Terv előnézet a terméken"
              className="block rounded border border-gray-200"
              style={{ maxWidth: 320, height: "auto" }}
            />
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            >
              Megnyitás új lapon
            </a>
          </div>
        )}

        {/* Design only — transparent background, real position + size */}
        <div>
          <p className="mb-2 text-xs font-medium text-gray-500">
            Minta (átlátszó háttér)
          </p>
          <div
            className="rounded border border-gray-200"
            style={{
              width: box.width,
              height: box.height,
              maxWidth: "100%",
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
            <object data={svgUrl} type="image/svg+xml" className="h-full w-full">
              <span className="text-sm text-gray-500">
                Az SVG nem tölthető be.
              </span>
            </object>
          </div>
          <a
            href={svgUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-blue-600 hover:underline"
          >
            Megnyitás új lapon
          </a>
        </div>
      </div>
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

  const isOrderForm = order.channel === "ORDER_FORM";
  // ORDER_FORM orders carry no address — delivery is agreed with the customer.
  const address =
    piiErased || !order.shippingAddress
      ? null
      : (order.shippingAddress as {
        address: string;
        city: string;
        postalCode: string;
        country: string;
      });

  const lines = getOrderLines(order);
  // Each designed line with its stored design. Legacy orders keep theirs on the order.
  const designedLines = lines.flatMap((line) => {
    const design =
      order.items.find((item) => item.id === line.key)?.design ??
      (line.key === order.id ? order.design : null);
    return design?.canvasJson ? [{ line, design }] : [];
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
                  <dd className="break-all text-gray-900">{order.customerEmail}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-gray-500">Telefon:</dt>
                  <dd className="text-gray-900">
                    <OrderPhoneEditor
                      orderId={order.id}
                      phone={order.customerPhone}
                    />
                  </dd>
                </div>
                {address && (
                  <>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-gray-500">Cím:</dt>
                      <dd className="text-gray-900">
                        {address.postalCode} {address.city}, {address.address}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-gray-500">Ország:</dt>
                      <dd className="text-gray-900">{address.country}</dd>
                    </div>
                  </>
                )}
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
                <dt className="w-24 shrink-0 text-gray-500">Forrás:</dt>
                <dd className="text-gray-900">{CHANNEL_LABELS[order.channel]}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-gray-500">Darabszám:</dt>
                <dd className="text-gray-900">
                  {lines.every((l) => l.quantity !== null)
                    ? `${lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0)} db`
                    : "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-gray-500">Összeg:</dt>
                <dd className="font-medium text-gray-900">
                  {order.totalAmount !== null
                    ? `${order.totalAmount.toLocaleString("hu-HU")} Ft`
                    : "Utólag egyeztetendő"}
                </dd>
              </div>
              {order.stripeSessionId && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-gray-500">Stripe:</dt>
                  <dd className="break-all font-mono text-xs text-gray-600">
                    {order.stripeSessionId}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <OrderLinesTable lines={lines} showPrices={!isOrderForm} />

        {isOrderForm && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Megrendelés szövege
            </h2>
            {order.customerNote !== null ? (
              <p className="whitespace-pre-wrap text-sm text-gray-900">
                {order.customerNote}
              </p>
            ) : (
              <p className="text-sm italic text-gray-400">Törölve.</p>
            )}
          </div>
        )}

        {order.attachments.length > 0 && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Csatolt fájlok
            </h2>
            <ul className="space-y-1 text-sm">
              {order.attachments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-2">
                  <a
                    href={`/api/admin/orders/${order.id}/attachments/${a.id}`}
                    className="break-all text-blue-600 hover:underline"
                  >
                    {a.fileName}
                  </a>
                  <span className="text-xs text-gray-500">
                    {formatFileSize(a.sizeBytes)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Shipping info — webshop orders only; ORDER_FORM delivery is agreed directly */}
        {!isOrderForm && (
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
        )}

        {designedLines.map(({ line, design }) => (
          <div key={design.id}>
            <DesignPreview
              orderId={order.id}
              designId={design.id}
              canvasJson={design.canvasJson}
              previewUrl={design.previewUrl}
              title={
                designedLines.length > 1
                  ? `Egyedi terv – ${line.productName} (${line.colorName} / ${line.sizeName})`
                  : "Egyedi terv"
              }
            />

            {/* Customer uploaded images — extracted from canvasJson */}
            <CustomerUploadedImages canvasJson={design.canvasJson} />

            {/* Design coordinates — parsed from canvasJson */}
            <DesignCoordinatesTable canvasJson={design.canvasJson} />
          </div>
        ))}

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
