import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import { getProducts } from "@/lib/malfini/client";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";
import type { MalfiniProduct } from "@/lib/malfini/types";

// force-dynamic because content varies by searchParams;
// getProducts() is module-level cached (1h) so no extra API calls per request.
export const dynamic = "force-dynamic";

const GENDER_LABELS: Record<string, string> = {
  GENTS: "Férfi",
  LADIES: "Női",
  UNISEX: "Uniszex",
  KIDS: "Gyerek",
  "GENTS/KIDS": "Férfi/Gyerek",
  "UNISEX/KIDS": "Uniszex/Gyerek",
};

export default async function AdminMalfiniCatalogPage({
  searchParams,
}: {
  searchParams: { category?: string; gender?: string };
}) {
  const allProducts = await getProducts("hu");

  // Only show categories that are configured for the designer (t-shirts, polo-shirts, sweatshirts)
  const configuredProducts = allProducts.filter(
    (p) => getCategoryConfig(p.categoryCode) !== null
  );

  // Build category list (unique, preserving API order of first occurrence)
  const categoryMap = new Map<string, string>();
  for (const p of configuredProducts) {
    if (!categoryMap.has(p.categoryCode)) {
      categoryMap.set(p.categoryCode, p.categoryName);
    }
  }
  const categories = Array.from(categoryMap.entries()); // [["t-shirts", "Pólók"], ...]

  // Apply category filter first
  const categoryFilter = searchParams.category ?? null;
  const afterCategoryFilter = categoryFilter
    ? configuredProducts.filter((p) => p.categoryCode === categoryFilter)
    : configuredProducts;

  // Build gender list from category-filtered products (so options reflect current category)
  const genderFilter = searchParams.gender ?? null;
  const availableGenderCodes = Array.from(
    new Set(afterCategoryFilter.map((p) => p.genderCode ?? "").filter(Boolean))
  ).sort();

  // Apply gender filter
  const visibleProducts = genderFilter
    ? afterCategoryFilter.filter((p) => p.genderCode === genderFilter)
    : afterCategoryFilter;

  // Build filter URLs
  function categoryUrl(code: string | null): string {
    if (!code) return "/admin/products/malfini";
    return `/admin/products/malfini?category=${code}`;
  }
  function genderUrl(code: string | null): string {
    if (!code) return `/admin/products/malfini${categoryFilter ? `?category=${categoryFilter}` : ""}`;
    const sep = categoryFilter ? "&" : "?";
    return `/admin/products/malfini${categoryFilter ? `?category=${categoryFilter}` : ""}${sep}gender=${code}`;
  }

  return (
    <div>
      <AdminNav />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
          <Link href="/admin/products" className="hover:text-gray-900 transition-colors">
            ← Termékek
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700">Malfini katalógus</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Malfini katalógus</h1>
          <p className="text-sm text-gray-500 mt-1">
            {visibleProducts.length} termék · csak megtekintés
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Category filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kategória:</span>
            <Link
              href={categoryUrl(null)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                !categoryFilter
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Összes
            </Link>
            {categories.map(([code, name]) => (
              <Link
                key={code}
                href={categoryUrl(code)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  categoryFilter === code
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {name}
              </Link>
            ))}
          </div>

          {/* Gender filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nem:</span>
            <Link
              href={genderUrl(null)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                !genderFilter
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Összes
            </Link>
            {availableGenderCodes.map((code) => (
              <Link
                key={code}
                href={genderUrl(code)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  genderFilter === code
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {GENDER_LABELS[code] ?? code}
              </Link>
            ))}
          </div>
        </div>

        {/* Product table */}
        {visibleProducts.length === 0 ? (
          <p className="text-gray-500">Nincs termék a szűrési feltételeknek megfelelően.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">Kód</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Név</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Kategória</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Változatok</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Nem</th>
                  <th className="px-4 py-3 w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleProducts.map((product: MalfiniProduct) => (
                  <tr key={product.code} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{product.code}</td>
                    <td className="px-4 py-3 text-gray-900">{product.name}</td>
                    <td className="px-4 py-3 text-gray-600">{product.categoryName}</td>
                    <td className="px-4 py-3 text-gray-600">{product.variants.length} szín</td>
                    <td className="px-4 py-3 text-gray-600">
                      {GENDER_LABELS[product.genderCode ?? ""] ?? product.genderCode ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/products/malfini/${product.code}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Megnyitás →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
