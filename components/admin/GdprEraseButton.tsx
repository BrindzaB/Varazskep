"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  orderId: string;
}

export default function GdprEraseButton({ orderId }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleErase() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/erase`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Hiba történt.");
        return;
      }
      router.refresh();
    } catch {
      setError("Hálózati hiba. Próbálja újra.");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3 mt-3">
        <p className="text-sm text-red-700">Biztosan törli a személyes adatokat? Ez nem vonható vissza.</p>
        <button
          onClick={handleErase}
          disabled={loading}
          className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Törlés…" : "Igen, törlöm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Mégse
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="mt-3 text-sm text-red-600 hover:text-red-800 transition-colors"
    >
      Személyes adatok törlése (GDPR)
    </button>
  );
}
