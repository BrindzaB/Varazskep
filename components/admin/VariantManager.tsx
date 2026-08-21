"use client";

import { useState } from "react";
import { TrashIcon } from "@/components/admin/icons";

export interface AdminVariant {
  id: string;
  color: string;
  size: string;
  price: number;
  stock: number;
  weightGrams: number | null;
}

interface Props {
  productId: string;
  initialVariants: AdminVariant[];
  // Known color names (from COLOR_MAP) offered as datalist suggestions so the
  // designer's colour-based mockup rendering keeps working.
  colorSuggestions: string[];
}

// Number fields are edited as strings so inputs can be cleared while typing.
interface RowState {
  color: string;
  size: string;
  price: string;
  stock: string;
  weightGrams: string;
}

interface Row {
  id: string;
  current: RowState;
  saved: RowState;
  saving: boolean;
  deleting: boolean;
}

function toRowState(v: AdminVariant): RowState {
  return {
    color: v.color,
    size: v.size,
    price: String(v.price),
    stock: String(v.stock),
    weightGrams: v.weightGrams != null ? String(v.weightGrams) : "",
  };
}

function emptyDraft(): RowState {
  return { color: "", size: "", price: "", stock: "0", weightGrams: "" };
}

function isDirty(row: Row): boolean {
  return JSON.stringify(row.current) !== JSON.stringify(row.saved);
}

interface VariantPayload {
  color: string;
  size: string;
  price: number;
  stock: number;
  weightGrams: number | null;
}

// Client-side mirror of the server validation, for immediate feedback.
function parseRow(
  r: RowState,
): { ok: true; value: VariantPayload } | { ok: false; error: string } {
  const color = r.color.trim();
  const size = r.size.trim();
  if (!color) return { ok: false, error: "A szín megadása kötelező." };
  if (!size) return { ok: false, error: "A méret megadása kötelező." };

  const price = Number(r.price);
  if (!Number.isInteger(price) || price <= 0) {
    return { ok: false, error: "Az ár pozitív egész szám legyen (Ft)." };
  }

  const stock = r.stock === "" ? 0 : Number(r.stock);
  if (!Number.isInteger(stock) || stock < 0) {
    return { ok: false, error: "A készlet nem lehet negatív, egész szám legyen." };
  }

  let weightGrams: number | null = null;
  if (r.weightGrams !== "") {
    const w = Number(r.weightGrams);
    if (!Number.isInteger(w) || w <= 0) {
      return { ok: false, error: "A súly pozitív egész szám legyen (gramm)." };
    }
    weightGrams = w;
  }

  return { ok: true, value: { color, size, price, stock, weightGrams } };
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400";

export default function VariantManager({
  productId,
  initialVariants,
  colorSuggestions,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialVariants.map((v) => ({
      id: v.id,
      current: toRowState(v),
      saved: toRowState(v),
      saving: false,
      deleting: false,
    })),
  );
  const [draft, setDraft] = useState<RowState>(emptyDraft());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRowField(id: string, field: keyof RowState, value: string) {
    setRows((rs) =>
      rs.map((r) =>
        r.id === id ? { ...r, current: { ...r.current, [field]: value } } : r,
      ),
    );
  }

  function setRowFlag(id: string, flag: "saving" | "deleting", value: boolean) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [flag]: value } : r)));
  }

  async function saveRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const parsed = parseRow(row.current);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setRowFlag(id, "saving", true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "A mentés nem sikerült.");
        return;
      }
      const snapshot = row.current;
      setRows((rs) =>
        rs.map((r) => (r.id === id ? { ...r, saved: snapshot } : r)),
      );
    } catch {
      setError("Hálózati hiba. Kérjük próbálja újra.");
    } finally {
      setRowFlag(id, "saving", false);
    }
  }

  async function deleteRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const confirmed = window.confirm(
      `Biztosan törlöd a(z) „${row.current.color} / ${row.current.size}” variánst? A művelet nem vonható vissza.`,
    );
    if (!confirmed) return;
    setError(null);
    setRowFlag(id, "deleting", true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "A törlés nem sikerült.");
        setRowFlag(id, "deleting", false);
        return;
      }
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch {
      setError("Hálózati hiba. Kérjük próbálja újra.");
      setRowFlag(id, "deleting", false);
    }
  }

  async function addDraft() {
    const parsed = parseRow(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "A hozzáadás nem sikerült.");
        return;
      }
      const created = (await res.json()) as AdminVariant;
      setRows((rs) => [
        ...rs,
        {
          id: created.id,
          current: toRowState(created),
          saved: toRowState(created),
          saving: false,
          deleting: false,
        },
      ]);
      setDraft(emptyDraft());
    } catch {
      setError("Hálózati hiba. Kérjük próbálja újra.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      {rows.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">
          Még nincs variáns. Adj hozzá legalább egyet, hogy a termék
          megvásárolható és tervezhető legyen.
        </p>
      ) : (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="pb-2 pr-3 font-medium">Szín</th>
                <th className="pb-2 pr-3 font-medium">Méret</th>
                <th className="pb-2 pr-3 font-medium">Ár (Ft)</th>
                <th className="pb-2 pr-3 font-medium">Készlet</th>
                <th className="pb-2 pr-3 font-medium">Súly (g)</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dirty = isDirty(row);
                const busy = row.saving || row.deleting;
                return (
                  <tr key={row.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-3">
                      <input
                        list="variant-color-suggestions"
                        value={row.current.color}
                        onChange={(e) =>
                          updateRowField(row.id, "color", e.target.value)
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        value={row.current.size}
                        onChange={(e) =>
                          updateRowField(row.id, "size", e.target.value)
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={1}
                        value={row.current.price}
                        onChange={(e) =>
                          updateRowField(row.id, "price", e.target.value)
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={0}
                        value={row.current.stock}
                        onChange={(e) =>
                          updateRowField(row.id, "stock", e.target.value)
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={1}
                        placeholder="500"
                        value={row.current.weightGrams}
                        onChange={(e) =>
                          updateRowField(row.id, "weightGrams", e.target.value)
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => saveRow(row.id)}
                          disabled={!dirty || busy}
                          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {row.saving ? "Mentés…" : "Mentés"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRow(row.id)}
                          disabled={busy}
                          title="Variáns törlése"
                          aria-label="Variáns törlése"
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new variant */}
      <div className="rounded-lg border border-dashed border-gray-300 p-4">
        <p className="mb-3 text-sm font-medium text-gray-700">Új variáns</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Szín</label>
            <input
              list="variant-color-suggestions"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              placeholder="pl. Fehér"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Méret</label>
            <input
              value={draft.size}
              onChange={(e) => setDraft({ ...draft, size: e.target.value })}
              placeholder="pl. M"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Ár (Ft)</label>
            <input
              type="number"
              min={1}
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              placeholder="pl. 4990"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Készlet</label>
            <input
              type="number"
              min={0}
              value={draft.stock}
              onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Súly (g)</label>
            <input
              type="number"
              min={1}
              value={draft.weightGrams}
              onChange={(e) =>
                setDraft({ ...draft, weightGrams: e.target.value })
              }
              placeholder="500"
              className={inputCls}
            />
          </div>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={addDraft}
            disabled={adding}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            {adding ? "Hozzáadás…" : "+ Variáns hozzáadása"}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <p className="mt-3 text-xs text-gray-400">
        Tipp: a tervező a színnevek alapján színezi a mockupot, ezért
        színezhető termékeknél (pl. póló, bögre) használj a felkínált listából
        ismert színnevet. A súly üresen hagyva 500 g-mal számol a szállítás.
      </p>

      <datalist id="variant-color-suggestions">
        {colorSuggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}
