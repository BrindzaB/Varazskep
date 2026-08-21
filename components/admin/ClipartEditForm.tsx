"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  clipartId: string;
  initialValues: {
    name: string;
    category: string;
    svgUrl: string;
    darkSvgUrl: string | null;
  };
  existingCategories: string[];
}

const fileInputCls =
  "block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition-colors";

export default function ClipartEditForm({
  clipartId,
  initialValues,
  existingCategories,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialValues.name);
  const [category, setCategory] = useState(initialValues.category);
  const [lightFile, setLightFile] = useState<File | null>(null);
  const [darkFile, setDarkFile] = useState<File | null>(null);
  const [removeDark, setRemoveDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDark = initialValues.darkSvgUrl !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("A név megadása kötelező.");
      return;
    }
    if (!category.trim()) {
      setError("A kategória megadása kötelező.");
      return;
    }

    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("category", category.trim());
    if (lightFile) fd.append("file", lightFile);
    if (darkFile) fd.append("darkFile", darkFile);
    if (removeDark && !darkFile) fd.append("removeDark", "true");

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clipart/${clipartId}`, {
        method: "PATCH",
        body: fd,
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "A mentés nem sikerült.");
        return;
      }
      router.push("/admin/clipart");
      router.refresh();
    } catch {
      setError("Hálózati hiba. Kérjük próbálja újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label htmlFor="clipart-name" className="mb-1 block text-sm font-medium text-gray-700">
          Név
        </label>
        <input
          id="clipart-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="clipart-category" className="mb-1 block text-sm font-medium text-gray-700">
          Kategória
        </label>
        <input
          id="clipart-category"
          type="text"
          list="category-suggestions"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        {existingCategories.length > 0 && (
          <datalist id="category-suggestions">
            {existingCategories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        )}
      </div>

      {/* Light version */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Világos verzió (SVG)
        </label>
        <div className="mb-2 flex h-20 w-20 items-center justify-center rounded border border-gray-200 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={initialValues.svgUrl} alt="Világos verzió" className="h-14 w-14 object-contain" />
        </div>
        <input
          type="file"
          accept=".svg,image/svg+xml"
          onChange={(e) => setLightFile(e.target.files?.[0] ?? null)}
          className={fileInputCls}
        />
        <p className="mt-1 text-xs text-gray-400">
          {lightFile ? `Új: ${lightFile.name}` : "Hagyd üresen, ha marad a jelenlegi."}
        </p>
      </div>

      {/* Dark version */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Sötét alaphoz tartozó verzió (SVG)
        </label>
        <div className="mb-2 flex h-20 w-20 items-center justify-center rounded border border-gray-700 bg-gray-800">
          {hasDark && !removeDark ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={initialValues.darkSvgUrl!} alt="Sötét verzió" className="h-14 w-14 object-contain" />
          ) : (
            <span className="text-xs text-gray-400">nincs</span>
          )}
        </div>
        <input
          type="file"
          accept=".svg,image/svg+xml"
          onChange={(e) => setDarkFile(e.target.files?.[0] ?? null)}
          className={fileInputCls}
        />
        <p className="mt-1 text-xs text-gray-400">
          {darkFile
            ? `Új: ${darkFile.name}`
            : "A tervező „Sötét alap” nézeténél ez jelenik meg."}
        </p>
        {hasDark && !darkFile && (
          <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={removeDark}
              onChange={(e) => setRemoveDark(e.target.checked)}
              className="h-4 w-4 accent-gray-900"
            />
            Sötét verzió eltávolítása
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Mentés…" : "Mentés"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/clipart")}
          className="px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          Mégse
        </button>
      </div>
    </form>
  );
}
