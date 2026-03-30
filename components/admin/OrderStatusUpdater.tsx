"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/lib/generated/prisma/client";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Függőben",
  PAID: "Fizetve",
  IN_PRODUCTION: "Gyártásban",
  SHIPPED: "Kiszállítva",
  COMPLETE: "Teljesítve",
  CANCELLED: "Törölve",
};

const NEXT_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Fizetve",
  PAID: "Gyártásba küld",
  IN_PRODUCTION: "Kiszállítva",
  SHIPPED: "Teljesítve",
  COMPLETE: "",
  CANCELLED: "",
};

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETE"],
  COMPLETE: [],
  CANCELLED: [],
};

interface Props {
  orderId: string;
  currentStatus: OrderStatus;
}

export default function OrderStatusUpdater({ orderId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextStatuses = ALLOWED_TRANSITIONS[currentStatus];

  async function handleUpdate(newStatus: OrderStatus) {
    setLoading(newStatus);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        setError(data.error ?? "Hiba történt");
        return;
      }

      router.refresh();
    } catch {
      setError("Hálózati hiba. Kérjük próbálja újra.");
    } finally {
      setLoading(null);
    }
  }

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Ez a rendelés már nem módosítható ({STATUS_LABELS[currentStatus]}).
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((status) => (
          <button
            key={status}
            onClick={() => handleUpdate(status)}
            disabled={loading !== null}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              status === "CANCELLED"
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-gray-900 text-white hover:bg-gray-700"
            }`}
          >
            {loading === status
              ? "Mentés..."
              : NEXT_STATUS_LABELS[status] || STATUS_LABELS[status]}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
