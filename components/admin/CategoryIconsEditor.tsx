"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CategoryIcon from "@/components/shop/CategoryIcon";
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_KEYS,
  DEFAULT_CATEGORY_ICON,
  type CategoryIconKey,
} from "@/lib/shop/categoryIcons";

interface Props {
  categories: string[]; // every local product category
  initialIcons: Record<string, CategoryIconKey>;
}

// Pictogram per local product category, shown above the category on the Termékek page.
// The clothing (Malfini) categories have fixed icons and are not listed here.
export default function CategoryIconsEditor({ categories, initialIcons }: Props) {
  const router = useRouter();
  const withDefaults = (icons: Record<string, CategoryIconKey>) =>
    Object.fromEntries(
      categories.map((c) => [c, icons[c] ?? DEFAULT_CATEGORY_ICON])
    ) as Record<string, CategoryIconKey>;

  const [icons, setIcons] = useState(() => withDefaults(initialIcons));
  const [saved, setSaved] = useState(() => withDefaults(initialIcons));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const dirty = JSON.stringify(icons) !== JSON.stringify(saved);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/category-icons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icons }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Hiba történt." });
        return;
      }
      setSaved(icons);
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
      <h2 className="text-sm font-semibold text-gray-700">Kategóriák ikonjai</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        A Termékek oldalon a kategória neve fölött megjelenő piktogram. A
        ruházati kategóriák ikonja rögzített.
      </p>

      {categories.length === 0 ? (
        <p className="text-sm text-gray-500">
          Még nincs kategóriába sorolt saját termék.
        </p>
      ) : (
        <ul className="mb-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
          {categories.map((category) => (
            <li
              key={category}
              className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
            >
              <CategoryIcon
                icon={icons[category]}
                className="h-6 w-6 shrink-0 text-brand-violet"
              />
              <span className="min-w-0 flex-1 font-medium text-gray-900">
                {category}
              </span>
              <select
                value={icons[category]}
                onChange={(e) => {
                  setIcons({
                    ...icons,
                    [category]: e.target.value as CategoryIconKey,
                  });
                  setMessage(null);
                }}
                aria-label={`„${category}” ikonja`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                {CATEGORY_ICON_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {CATEGORY_ICONS[key]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}

      {categories.length > 0 && (
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Mentés..." : "Mentés"}
        </button>
      )}
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
