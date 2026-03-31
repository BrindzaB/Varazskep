"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  existingCategories: string[];
}

export default function ClipartUploadForm({ existingCategories }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Válassz ki egy SVG fájlt.");
      return;
    }
    if (!name.trim()) {
      setError("A név megadása kötelező.");
      return;
    }
    if (!category.trim()) {
      setError("A kategória megadása kötelező.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name.trim());
    formData.append("category", category.trim());

    setLoading(true);
    try {
      const res = await fetch("/api/admin/clipart", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Ismeretlen hiba.");
        return;
      }

      router.push("/admin/clipart");
      router.refresh();
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* SVG file */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          SVG fájl
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition-colors"
        />
        {file && (
          <p className="mt-1 text-xs text-gray-500">{file.name}</p>
        )}
      </div>

      {/* Name */}
      <div>
        <label htmlFor="clipart-name" className="block text-sm font-medium text-gray-700 mb-1">
          Név
        </label>
        <input
          id="clipart-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="pl. Macska"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="clipart-category" className="block text-sm font-medium text-gray-700 mb-1">
          Kategória
        </label>
        <input
          id="clipart-category"
          type="text"
          list="category-suggestions"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="pl. Állatok"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        {existingCategories.length > 0 && (
          <datalist id="category-suggestions">
            {existingCategories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Feltöltés…" : "Feltöltés"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/clipart")}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Mégse
        </button>
      </div>
    </form>
  );
}
