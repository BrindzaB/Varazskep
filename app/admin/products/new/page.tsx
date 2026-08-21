import AdminNav from "@/components/admin/AdminNav";
import ProductForm from "@/components/admin/ProductForm";
import Link from "next/link";
import { getProductCategories } from "@/lib/services/product";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await getProductCategories();

  return (
    <div>
      <AdminNav />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin/products"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Termékek
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600">Új termék</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Új termék</h1>
        <p className="mb-6 text-sm text-gray-500">
          Előbb hozd létre a terméket az alábbi alapadatokkal. Mentés után
          automatikusan a szerkesztő oldalra kerülsz, ahol variánsokat (szín,
          méret, ár, készlet) és színenkénti képeket adhatsz hozzá.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <ProductForm categorySuggestions={categories} />
        </div>
      </main>
    </div>
  );
}
