"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatHuf } from "@/lib/utils/format";
import { realisedMarkupPct } from "@/lib/pricing/compute";

export interface EditorRow {
  sku: string;
  sizeName: string;
  costNetHuf: number | null;
  // Price the árrés rule produces. Null when Malfini has no cost for the SKU.
  computedHuf: number | null;
  // Manual price, or null when the rule applies.
  overrideHuf: number | null;
  recommendedHuf: number | null;
  stock: number;
}

export interface EditorVariant {
  code: string;
  name: string;
  colorIconLink: string;
  frontImage: string | null;
  attributes: { code: string; title: string; text: string }[];
  rows: EditorRow[];
}

interface Props {
  productCode: string;
  variants: EditorVariant[];
  vatPct: number;
}

function stockColorClass(qty: number): string {
  if (qty === 0) return "text-red-600";
  if (qty <= 5) return "text-yellow-600";
  return "text-green-700";
}

// The price in effect for a row before any editing.
function effectivePrice(row: EditorRow): number | null {
  return row.overrideHuf ?? row.computedHuf;
}

const inputCls =
  "w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-gray-400";

export default function MalfiniPriceEditor({
  productCode,
  variants,
  vatPct,
}: Props) {
  const router = useRouter();

  const allRows = useMemo(() => variants.flatMap((v) => v.rows), [variants]);

  const baseline = useMemo(() => {
    const out: Record<string, string> = {};
    for (const row of allRows) {
      const price = effectivePrice(row);
      out[row.sku] = price === null ? "" : String(price);
    }
    return out;
  }, [allRows]);

  const [values, setValues] = useState<Record<string, string>>(baseline);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulk, setBulk] = useState("");

  const rowsBySku = useMemo(() => {
    const m = new Map<string, EditorRow>();
    for (const row of allRows) m.set(row.sku, row);
    return m;
  }, [allRows]);

  const dirtySkus = Object.keys(values).filter(
    (sku) => (values[sku] ?? "") !== (baseline[sku] ?? "")
  );

  function setValue(sku: string, v: string) {
    setValues((prev) => ({ ...prev, [sku]: v }));
    setError(null);
  }

  // Applies one value to every size of the product.
  function applyToAll(price: number | null) {
    setValues(() => {
      const next: Record<string, string> = {};
      for (const row of allRows) {
        if (price !== null) {
          next[row.sku] = String(price);
        } else {
          // "Reset all" → back to the computed price, which the save treats as a clear.
          next[row.sku] =
            row.computedHuf === null ? "" : String(row.computedHuf);
        }
      }
      return next;
    });
    setError(null);
  }

  function applyRecommended() {
    setValues(() => {
      const next: Record<string, string> = {};
      for (const row of allRows) {
        next[row.sku] =
          row.recommendedHuf !== null
            ? String(row.recommendedHuf)
            : (values[row.sku] ?? "");
      }
      return next;
    });
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    // A value equal to the computed price means "let the rule apply" — clear the override.
    const toSet: {
      productSizeCode: string;
      productCode: string;
      priceHuf: number;
    }[] = [];
    const toClear: string[] = [];

    for (const sku of dirtySkus) {
      const row = rowsBySku.get(sku);
      if (!row) continue;
      const raw = (values[sku] ?? "").trim();

      if (raw === "") {
        if (row.overrideHuf !== null) toClear.push(sku);
        continue;
      }

      const priceHuf = Number(raw);
      if (!Number.isInteger(priceHuf) || priceHuf <= 0) {
        setError(`${row.sizeName}: az ár pozitív egész szám legyen (Ft).`);
        setSaving(false);
        return;
      }

      if (priceHuf === row.computedHuf) {
        if (row.overrideHuf !== null) toClear.push(sku);
      } else {
        toSet.push({ productSizeCode: sku, productCode, priceHuf });
      }
    }

    try {
      if (toSet.length > 0) {
        const res = await fetch("/api/admin/pricing/overrides", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: toSet }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Nem sikerült menteni.");
          setSaving(false);
          return;
        }
      }
      if (toClear.length > 0) {
        const res = await fetch("/api/admin/pricing/overrides", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productSizeCodes: toClear }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Nem sikerült törölni a felülírást.");
          setSaving(false);
          return;
        }
      }
      // Server component re-renders with the new baseline, which resets the inputs.
      router.refresh();
    } catch {
      setError("Hálózati hiba — a mentés nem sikerült.");
    } finally {
      setSaving(false);
    }
  }

  const overrideCount = allRows.filter((r) => r.overrideHuf !== null).length;
  const bulkPrice = Number(bulk);
  const bulkValid =
    bulk.trim() !== "" && Number.isInteger(bulkPrice) && bulkPrice > 0;

  return (
    <div className="space-y-6">
      {/* Bulk actions — a product has 4 colours × ~6 sizes, so per-row typing is unworkable */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Árazás az egész termékre
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          {overrideCount === 0
            ? "Jelenleg minden méret az árrés-szabály szerint árazódik."
            : `${overrideCount} méretnek van kézi ára, a többi a szabály szerint árazódik.`}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder="Ft"
            className={inputCls}
          />
          <button
            onClick={() => {
              applyToAll(bulkPrice);
              setBulk("");
            }}
            disabled={!bulkValid}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Minden méretre
          </button>
          <button
            onClick={applyRecommended}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Malfini ajánlott árra
          </button>
          <button
            onClick={() => applyToAll(null)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Vissza a szabály szerinti árra
          </button>
        </div>
      </section>

      {variants.map((variant) => (
        <section
          key={variant.code}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={variant.colorIconLink}
              alt=""
              className="h-6 w-6 rounded-full border border-gray-200 object-cover"
            />
            <span className="font-medium text-gray-900">{variant.name}</span>
            <span className="font-mono text-xs text-gray-400">
              {variant.code}
            </span>
            {variant.frontImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={variant.frontImage}
                alt={variant.name}
                className="ml-auto h-12 w-12 object-contain"
              />
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="w-20 px-4 py-2 text-left font-medium text-gray-500">
                    Méret
                  </th>
                  <th className="w-32 px-4 py-2 text-left font-medium text-gray-500">
                    SKU
                  </th>
                  <th className="w-24 px-4 py-2 text-right font-medium text-gray-500">
                    Beszerzés
                  </th>
                  <th className="w-24 px-4 py-2 text-right font-medium text-gray-500">
                    Szabály sz.
                  </th>
                  <th className="w-32 px-4 py-2 text-right font-medium text-gray-500">
                    Bolti ár
                  </th>
                  <th className="w-20 px-4 py-2 text-right font-medium text-gray-500">
                    Árrés
                  </th>
                  <th className="w-24 px-4 py-2 text-right font-medium text-gray-500">
                    Malfini aj.
                  </th>
                  <th className="w-28 px-4 py-2 text-left font-medium text-gray-500">
                    Készlet
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {variant.rows.map((row) => {
                  const raw = (values[row.sku] ?? "").trim();
                  const parsed = Number(raw);
                  const livePrice =
                    raw !== "" && Number.isFinite(parsed) && parsed > 0
                      ? parsed
                      : null;
                  const isOverridden =
                    livePrice !== null && livePrice !== row.computedHuf;
                  const liveMarkup =
                    livePrice !== null && row.costNetHuf !== null
                      ? realisedMarkupPct(livePrice, row.costNetHuf, vatPct)
                      : null;
                  const isDirty =
                    (values[row.sku] ?? "") !== (baseline[row.sku] ?? "");

                  return (
                    <tr key={row.sku} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">
                        {row.sizeName}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">
                        {row.sku}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {row.costNetHuf === null
                          ? "—"
                          : formatHuf(row.costNetHuf)}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-400">
                        {row.computedHuf === null
                          ? "—"
                          : formatHuf(row.computedHuf)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isOverridden && (
                            <span
                              title="Kézi ár — az árrés-szabály nem érvényes rá"
                              className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                            >
                              kézi
                            </span>
                          )}
                          <input
                            type="number"
                            value={values[row.sku] ?? ""}
                            onChange={(e) => setValue(row.sku, e.target.value)}
                            className={`${inputCls} ${
                              isDirty ? "border-gray-900 bg-yellow-50" : ""
                            }`}
                          />
                        </div>
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          liveMarkup === null
                            ? "text-gray-400"
                            : liveMarkup < 20
                              ? "text-red-600"
                              : "text-green-700"
                        }`}
                      >
                        {liveMarkup === null
                          ? "—"
                          : `${liveMarkup.toFixed(1)}%`}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-400">
                        {row.recommendedHuf === null
                          ? "—"
                          : formatHuf(row.recommendedHuf)}
                      </td>
                      <td
                        className={`px-4 py-2 font-medium ${stockColorClass(row.stock)}`}
                      >
                        {row.stock === 0
                          ? "Nincs készleten"
                          : `${row.stock} db`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {variant.attributes.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                {variant.attributes.map((attr) => (
                  <div key={attr.code} className="flex gap-1">
                    <dt className="text-gray-400">{attr.title}:</dt>
                    <dd className="text-gray-600">{attr.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      ))}

      {/* Sticky save bar — the tables are long enough that a footer button would be missed */}
      {(dirtySkus.length > 0 || error) && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-gray-300 bg-white p-3 shadow-lg">
          <button
            onClick={handleSave}
            disabled={saving || dirtySkus.length === 0}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Mentés…" : `Mentés (${dirtySkus.length} méret)`}
          </button>
          <button
            onClick={() => {
              setValues(baseline);
              setError(null);
            }}
            disabled={saving}
            className="text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            Elvetés
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
          <span className="text-xs text-gray-500">
            A „Szabály sz.” árral egyező érték törli a kézi árat.
          </span>
        </div>
      )}
    </div>
  );
}
