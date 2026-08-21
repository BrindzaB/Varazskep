"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/admin/icons";

interface Props {
  productId: string;
  productName: string;
}

export default function ProductDeleteButton({ productId, productName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Biztosan törlöd a(z) „${productName}” terméket? A művelet nem vonható vissza.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? "A termék törlése nem sikerült.");
        return;
      }
      router.refresh();
    } catch {
      alert("Hálózati hiba. Kérjük próbálja újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      title="Törlés"
      aria-label={`„${productName}” törlése`}
      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
