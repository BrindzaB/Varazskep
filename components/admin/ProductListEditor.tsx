"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [toAdd, setToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const optionOf = (value: string) => options.find((o) => o.value === value);
  const addable = options.filter((o) => !values.includes(o.value));
  const full = maxItems !== undefined && values.length >= maxItems;
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

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={toAdd}
          onChange={(e) => setToAdd(e.target.value)}
          disabled={full}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        >
          <option value="">
            {full ? `Legfeljebb ${maxItems} termék lehet` : "Termék hozzáadása…"}
          </option>
          {addable.map((o) => (
            <option key={o.value} value={o.value}>
              {o.tag} — {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!toAdd || full}
          onClick={() => {
            setValues([...values, toAdd]);
            setToAdd("");
          }}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          Hozzáadás
        </button>
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
