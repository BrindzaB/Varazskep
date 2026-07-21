"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  orderId: string;
  kvikkTrackingNumber: string | null;
  courierTrackingNumber: string | null;
}

export default function ShipmentActions({
  orderId,
  kvikkTrackingNumber,
  courierTrackingNumber,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipment`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Hiba történt a csomagfeladáskor.");
        return;
      }
      router.refresh();
    } catch {
      setError("Hálózati hiba. Kérjük, próbálja újra.");
    } finally {
      setLoading(false);
    }
  }

  // Shipment already created — show tracking numbers, tracking link, and label download.
  if (kvikkTrackingNumber) {
    return (
      <div className="space-y-1 text-sm">
        <div className="flex gap-2">
          <span className="w-36 shrink-0 text-gray-500">Kvikk követés:</span>
          <a
            href={`https://tracking.kvikk.hu/#/${kvikkTrackingNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-blue-600 hover:underline"
          >
            {kvikkTrackingNumber}
          </a>
        </div>
        {courierTrackingNumber && (
          <div className="flex gap-2">
            <span className="w-36 shrink-0 text-gray-500">Futár követés:</span>
            <span className="font-mono text-xs text-gray-600">
              {courierTrackingNumber}
            </span>
          </div>
        )}
        <a
          href={`/api/admin/orders/${orderId}/label`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
        >
          Címke letöltése (PDF)
        </a>
      </div>
    );
  }

  // No shipment yet — offer to create it (label generation).
  return (
    <div className="space-y-2">
      <button
        onClick={handleCreate}
        disabled={loading}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Feladás..." : "Csomagfeladás (címke generálása)"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
