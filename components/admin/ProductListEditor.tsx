"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { compareNamesHu, matchesSearch } from "@/lib/shop/productList";

export interface ProductListOption {
  value: string; // what gets saved, e.g. a Malfini code or a popular key
  tag: string; // short identifier shown in the mono column, e.g. "129" or "saját"
  label: string; // e.g. "Basic · Pólók · Férfi"
}

interface Props {
  title: string;
  description: string;
  endpoint: string; // PUT target
  payloadKey: string; // the body is { [payloadKey]: values }
  initialValues: string[];
  options: ProductListOption[];
  maxItems?: number;
  allowEmpty?: boolean; // whether saving an empty list is meaningful
  emptyText: string;
}

// An admin-curated, ordered product list: add from the options, reorder, remove, save.
// Used for the featured Malfini products and the Termékek page's popular products.
export default function ProductListEditor({
  title,
  description,
  endpoint,
  payloadKey,
  initialValues,
  options,
  maxItems,
  allowEmpty = false,
  emptyText,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<string[]>(initialValues);
  const [query, setQuery] = useState("");
  // The alphabetical list opens on focus, so it can be browsed as well as searched.
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const optionOf = (value: string) => options.find((o) => o.value === value);
  const full = maxItems !== undefined && values.length >= maxItems;

  // Not yet listed options, alphabetical, narrowed by the search box (name or tag).
  const addable = useMemo(
    () =>
      options
        .filter((o) => !values.includes(o.value))
        .filter((o) => matchesSearch([o.label, o.tag], query))
        .sort((a, b) => compareNamesHu(a.label, b.label)),
    [options, values, query]
  );

  function add(value: string) {
    setValues([...values, value]);
    setQuery("");
    setMessage(null);
  }
  const dirty = values.join(",") !== initialValues.join(",");

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    setValues(next);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [payloadKey]: values }),
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
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">{description}</p>

      <ol className="mb-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
        {values.map((value, i) => {
          const option = optionOf(value);
          return (
            <li key={value} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-12 shrink-0 font-mono text-xs text-gray-500">
                {option?.tag ?? "?"}
              </span>
              <span className="min-w-0 flex-1 text-gray-900">
                {option?.label ?? "Nem található"}
              </span>
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
                disabled={i === values.length - 1}
                className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                aria-label="Lejjebb"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setValues(values.filter((v) => v !== value))}
                className="rounded px-2 py-1 text-red-600 hover:bg-red-50"
                aria-label="Eltávolítás"
              >
                ✕
              </button>
            </li>
          );
        })}
        {values.length === 0 && (
          <li className="px-3 py-2 text-sm text-gray-500">{emptyText}</li>
        )}
      </ol>

      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={full}
            placeholder={
              full
                ? `Legfeljebb ${maxItems} termék lehet`
                : "Termék hozzáadása — keresés név vagy kód szerint…"
            }
            aria-label="Termék keresése a hozzáadáshoz"
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
          />
          {!full && (open || query.trim() !== "") && (
            <ul className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              {addable.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    // mousedown, not click: the input's blur would close the list first.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(o.value);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="w-12 shrink-0 font-mono text-xs text-gray-500">
                      {o.tag}
                    </span>
                    <span className="min-w-0 flex-1 text-gray-900">{o.label}</span>
                    <span className="shrink-0 text-xs font-medium text-gray-500">
                      + Hozzáadás
                    </span>
                  </button>
                </li>
              ))}
              {addable.length === 0 && (
                <li className="px-3 py-2 text-sm text-gray-500">Nincs találat.</li>
              )}
            </ul>
          )}
        </div>
        <button
          type="button"
          disabled={!dirty || saving || (!allowEmpty && values.length === 0)}
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
