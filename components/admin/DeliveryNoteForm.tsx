"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COURIER_LABELS } from "@/lib/shipping/display";
import type { CreateDeliveryNoteData } from "@/lib/kvikk/types";

interface DispatchableOrder {
  id: string;
  trackingNumber: string;
  courier: string;
  customerName: string;
  productName: string;
}

interface Props {
  orders: DispatchableOrder[];
}

function courierLabel(slug: string): string {
  return COURIER_LABELS[slug] ?? slug;
}

// Decodes a base64 PDF and triggers a browser download.
function downloadPdf(base64: string, filename: string): void {
  const chars = atob(base64);
  const bytes = new Uint8Array(chars.length);
  for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DeliveryNoteForm({ orders }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [excludedPickup, setExcludedPickup] = useState<Set<string>>(new Set());
  const [pickupDate, setPickupDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateDeliveryNoteData | null>(null);

  // Distinct couriers among the currently-selected orders.
  const availableCouriers = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      if (selected.has(o.trackingNumber)) set.add(o.courier);
    }
    return Array.from(set);
  }, [orders, selected]);

  const today = new Date().toISOString().slice(0, 10);

  function toggleOrder(trackingNumber: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(trackingNumber)) next.delete(trackingNumber);
      else next.add(trackingNumber);
      return next;
    });
    setError(null);
  }

  function togglePickup(courier: string) {
    setExcludedPickup((prev) => {
      const next = new Set(prev);
      if (next.has(courier)) next.delete(courier);
      else next.add(courier);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      setError("Válassz ki legalább egy csomagot.");
      return;
    }
    if (!pickupDate) {
      setError("Adj meg felvételi dátumot.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);

    const pickupFor = availableCouriers.filter((c) => !excludedPickup.has(c));
    try {
      const res = await fetch("/api/admin/delivery-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupDate: `${pickupDate}T00:00:00.000Z`,
          pickupFor,
          shipments: Array.from(selected),
        }),
      });
      const data = (await res.json()) as CreateDeliveryNoteData & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Hiba történt a futárrendeléskor.");
        return;
      }
      setResult(data);
      setSelected(new Set());
      router.refresh(); // dispatched orders drop off the list
    } catch {
      setError("Hálózati hiba. Kérjük, próbálja újra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Result of a completed delivery note */}
      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h2 className="mb-2 text-sm font-semibold text-green-800">
            Szállítólevél létrehozva
          </h2>
          <p className="mb-3 text-sm text-green-700">
            Sikeres: {result.successfulShipments.length} csomag
            {result.failedShipments.length > 0
              ? ` · Sikertelen: ${result.failedShipments.length}`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {result.deliveryNote.documents.map((doc) => (
              <button
                key={doc.courier + doc.id}
                onClick={() => downloadPdf(doc.pdf, doc.document)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                {courierLabel(doc.courier)} szállítólevél (PDF)
              </button>
            ))}
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-3 list-inside list-disc text-sm text-red-600">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nincs feladásra váró csomag. (A csomagfeladás a rendelés részleteinél,
          a „Csomagfeladás” gombbal történik.)
        </p>
      ) : (
        <>
          {/* Order selection */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Feladásra váró csomagok
            </h2>
            <ul className="divide-y divide-gray-100">
              {orders.map((o) => (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(o.trackingNumber)}
                      onChange={() => toggleOrder(o.trackingNumber)}
                      className="h-4 w-4 accent-gray-900"
                    />
                    <span className="text-sm text-gray-900">
                      <span className="font-medium">
                        {courierLabel(o.courier)}
                      </span>{" "}
                      ·{" "}
                      <span className="font-mono text-xs">
                        {o.trackingNumber}
                      </span>{" "}
                      · {o.customerName} — {o.productName}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {/* Pickup options */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4">
              <label
                htmlFor="pickupDate"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Felvételi dátum (munkanap)
              </label>
              <input
                id="pickupDate"
                type="date"
                min={today}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </div>

            {availableCouriers.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 text-sm font-medium text-gray-700">
                  Futárt kérek a felvételre:
                </p>
                <div className="flex flex-wrap gap-4">
                  {availableCouriers.map((c) => (
                    <label
                      key={c}
                      className="flex cursor-pointer items-center gap-2 text-sm text-gray-900"
                    >
                      <input
                        type="checkbox"
                        checked={!excludedPickup.has(c)}
                        onChange={() => togglePickup(c)}
                        className="h-4 w-4 accent-gray-900"
                      />
                      {courierLabel(c)}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Kikapcsolt futárnál a csomagot magad viszed be (drop-off).
                </p>
              </div>
            )}

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || selected.size === 0}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Futárrendelés..."
                : `Futárrendelés (${selected.size} csomag)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
