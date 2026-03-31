"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  productId: string;
  active: boolean;
}

export default function ProductToggleButton({ productId, active }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleActive: !active }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-50 transition-colors"
    >
      {active ? "Inaktiválás" : "Aktiválás"}
    </button>
  );
}
