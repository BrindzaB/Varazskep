"use client";

import { useState } from "react";
import type { ShopSettings } from "@/lib/services/shopSettings";

interface Props {
  initial: ShopSettings;
}

export default function ShopSettingsForm({ initial }: Props) {
  const [email, setEmail] = useState(initial.notificationEmail);
  const [saved, setSaved] = useState(initial.notificationEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const dirty = email.trim() !== saved;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmail: email }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Nem sikerült menteni.");
        return;
      }
      setSaved(body.notificationEmail);
      setEmail(body.notificationEmail);
      setDone(true);
    } catch {
      setError("Hálózati hiba — a mentés nem sikerült.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-8 space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900">Értesítések</h2>

        <label className="mt-4 block">
          <span className="block text-sm font-medium text-gray-700">
            Értesítési e-mail cím
          </span>
          <span className="mt-0.5 block text-xs text-gray-500">
            Minden új rendelésről (webshop és megrendelő lap) ide érkezik
            értesítés.
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setDone(false);
              setError(null);
            }}
            className="mt-2 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Mentés…" : "Mentés"}
        </button>
        {done && !dirty && (
          <span className="text-sm text-green-700">Mentve.</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
