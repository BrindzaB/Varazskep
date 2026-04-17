"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ProductFormValues {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  mockupType: string;
  active: boolean;
}

interface Props {
  productId?: string;
  initialValues?: Partial<ProductFormValues>;
}

const MOCKUP_OPTIONS = [
  { value: "", label: "Nincs (nem tervezhető)" },
  { value: "tshirt", label: "Póló" },
  { value: "mug", label: "Bögre" },
  { value: "pillow", label: "Párna" },
];

const DEFAULT_VALUES: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  mockupType: "",
  active: true,
};

export default function ProductForm({ productId, initialValues }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value, type } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  // Auto-generate slug from name if creating a new product
  function handleNameBlur() {
    if (!productId && !values.slug) {
      const slug = values.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setValues((prev) => ({ ...prev, slug }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = productId ? `/api/admin/products/${productId}` : "/api/admin/products";
      const method = productId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          mockupType: values.mockupType || null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        setError(data.error ?? "Hiba történt");
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Hálózati hiba. Kérjük próbálja újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Termék neve <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          type="text"
          required
          value={values.name}
          onChange={handleChange}
          onBlur={handleNameBlur}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Slug <span className="text-red-500">*</span>
        </label>
        <input
          name="slug"
          type="text"
          required
          value={values.slug}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <p className="text-xs text-gray-500 mt-1">URL-ben használt azonosító, pl. egyedi-polo</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Leírás</label>
        <textarea
          name="description"
          rows={3}
          value={values.description}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kép URL</label>
        <input
          name="imageUrl"
          type="url"
          value={values.imageUrl}
          onChange={handleChange}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tervező típus</label>
        <select
          name="mockupType"
          value={values.mockupType}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          {MOCKUP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="active"
          name="active"
          type="checkbox"
          checked={values.active}
          onChange={handleChange}
          className="w-4 h-4 rounded border-gray-300"
        />
        <label htmlFor="active" className="text-sm font-medium text-gray-700">
          Aktív (látható a webshopban)
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Mentés..." : "Mentés"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products")}
          className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Mégse
        </button>
      </div>
    </form>
  );
}
