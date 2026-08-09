"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidHungarianPhone } from "@/lib/utils/phone";

interface Props {
  orderId: string;
  phone: string | null;
}

// Inline display + edit of the recipient phone on the admin order detail page. Lets an admin
// correct a malformed number before the Kvikk shipment is created. The server route
// normalizes + validates authoritatively; the client check is only for instant feedback.
export default function OrderPhoneEditor({ orderId, phone }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!isValidHungarianPhone(value)) {
      setError("Érvénytelen telefonszám (pl. +36 20 123 4567).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/phone`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: value }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Nem sikerült menteni a telefonszámot.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Hálózati hiba. Kérjük, próbálja újra.");
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-2">
        <span className={phone ? "text-gray-900" : "italic text-gray-400"}>
          {phone ?? "nincs megadva"}
        </span>
        <button
          type="button"
          onClick={() => {
            setValue(phone ?? "");
            setError(null);
            setEditing(true);
          }}
          className="text-xs text-blue-600 hover:underline"
        >
          Szerkesztés
        </button>
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <input
          type="tel"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          placeholder="+36 20 123 4567"
          className="w-44 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Mentés..." : "Mentés"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          disabled={loading}
          className="text-xs text-gray-500 hover:underline disabled:opacity-50"
        >
          Mégse
        </button>
      </span>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
