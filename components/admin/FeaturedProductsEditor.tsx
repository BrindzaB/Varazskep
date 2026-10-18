"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface FeaturedOption {
  code: string;
  label: string; // e.g. "Basic — Pólók · Férfi"
}

interface Props {
  initialCodes: string[];
  options: FeaturedOption[]; // every designer-enabled product
}

// Ordered list of the featured Malfini products — shown in the designer's product picker
// and offered on the order form (megrendelő lap).
export default function FeaturedProductsEditor({ initialCodes, options }: Props) {
  const router = useRouter();
  const [codes, setCodes] = useState<string[]>(initialCodes);
  const [toAdd, setToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const labelOf = (code: string) =>
    options.find((o) => o.code === code)?.label ?? "Nem található a katalógusban";
  const addable = options.filter((o) => !codes.includes(o.code));
  const dirty = codes.join(",") !== initialCodes.join(",");

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= codes.length) return;
    const next = [...codes];
    [next[index], next[target]] = [next[target], next[index]];
    setCodes(next);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/featured-products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Hiba történt." });
        return;
      }
      setMessage({ ok: true, text: "Mentve." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Hálózati hiba. Próbáld újra." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700">Kiemelt termékek</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Ezek jelennek meg a Tervező termékválasztójában és a megrendelő lapon, ebben
        a sorrendben.
      </p>

      <ol className="mb-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
        {codes.map((code, i) => (
          <li key={code} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-10 font-mono text-xs text-gray-500">{code}</span>
            <span className="flex-1 text-gray-900">{labelOf(code)}</span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              aria-label="Feljebb"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === codes.length - 1}
              className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              aria-label="Lejjebb"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => setCodes(codes.filter((c) => c !== code))}
              className="rounded px-2 py-1 text-red-600 hover:bg-red-50"
              aria-label="Eltávolítás"
            >
              ✕
            </button>
          </li>
        ))}
        {codes.length === 0 && (
          <li className="px-3 py-2 text-sm text-gray-500">Nincs kiemelt termék.</li>
        )}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={toAdd}
          onChange={(e) => setToAdd(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Termék hozzáadása…</option>
          {addable.map((o) => (
            <option key={o.code} value={o.code}>
              {o.code} — {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!toAdd}
          onClick={() => {
            setCodes([...codes, toAdd]);
            setToAdd("");
          }}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          Hozzáadás
        </button>
        <button
          type="button"
          disabled={!dirty || saving || codes.length === 0}
          onClick={save}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Mentés..." : "Mentés"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-2 text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
