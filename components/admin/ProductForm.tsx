"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getMockupTemplates } from "@/lib/designer/mockupConfig";
import { PencilIcon, TrashIcon } from "@/components/admin/icons";

export interface ProductFormValues {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  category: string;
  mockupType: string;
  active: boolean;
}

interface Props {
  productId?: string;
  initialValues?: Partial<ProductFormValues>;
  // Existing storefront categories, offered as datalist suggestions.
  categorySuggestions?: string[];
}

// Designer-template options come from the code registry (single source of truth):
// add a template there and it becomes selectable here automatically.
const MOCKUP_OPTIONS = [
  { value: "", label: "Nincs (nem tervezhető)" },
  ...getMockupTemplates().map((t) => ({ value: t.key, label: t.label })),
];

const DEFAULT_VALUES: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  category: "",
  mockupType: "",
  active: true,
};

export default function ProductForm({
  productId,
  initialValues,
  categorySuggestions = [],
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setImageError(null);
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/products/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setImageError(d.error ?? "A feltöltés nem sikerült.");
        return;
      }
      const { url } = (await res.json()) as { url: string };
      setValues((prev) => ({ ...prev, imageUrl: url }));
    } catch {
      setImageError("Hálózati hiba. Kérjük próbálja újra.");
    } finally {
      setUploadingImage(false);
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

      // On create, jump straight to the edit page so variants can be added
      // right away (a product without variants is not sellable). On update,
      // return to the list.
      if (!productId) {
        const created = (await res.json()) as { id: string };
        router.push(`/admin/products/${created.id}`);
      } else {
        router.push("/admin/products");
      }
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Kategória</label>
        <input
          name="category"
          type="text"
          list="product-category-suggestions"
          value={values.category}
          onChange={handleChange}
          placeholder="pl. Bögrék"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <p className="text-xs text-gray-500 mt-1">
          A webshop kategória-füle (pl. Bögrék, Párnák). Üresen hagyva csak az
          „Összes” fül alatt jelenik meg.
        </p>
        {categorySuggestions.length > 0 && (
          <datalist id="product-category-suggestions">
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Termékkép (fő kép)
        </label>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {values.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={values.imageUrl}
                alt="Termékkép"
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs text-gray-400">nincs kép</span>
            )}
          </div>
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-1">
              <label
                title={values.imageUrl ? "Csere" : "Kép feltöltése"}
                aria-label={values.imageUrl ? "Kép cseréje" : "Kép feltöltése"}
                className={`cursor-pointer rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 ${
                  uploadingImage ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <PencilIcon className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
              {values.imageUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setValues((prev) => ({ ...prev, imageUrl: "" }))
                  }
                  title="Eltávolítás"
                  aria-label="Kép eltávolítása"
                  className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
              {uploadingImage && (
                <span className="text-xs text-gray-400">Feltöltés…</span>
              )}
            </div>
            <p className="text-xs text-gray-400">PNG, JPG, WEBP vagy SVG, max. 5 MB.</p>
          </div>
        </div>
        {imageError && <p className="mt-2 text-sm text-red-600">{imageError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tervező sablon
        </label>
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
        <p className="text-xs text-gray-500 mt-1">
          Melyik tervező-sablonnal szerkeszthető a termék. „Nincs” esetén
          eladható, de nem tervezhető. Új sablon hozzáadása fejlesztői feladat.
        </p>
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
