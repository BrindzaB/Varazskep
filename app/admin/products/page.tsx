import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import ProductToggleButton from "@/components/admin/ProductToggleButton";
import { getAllProductsAdmin } from "@/lib/services/product";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await getAllProductsAdmin();

  return (
    <div>
      <AdminNav />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Termékek</h1>
          <Link
            href="/admin/products/new"
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Új termék
          </Link>
        </div>

        {products.length === 0 ? (
          <p className="text-gray-500">Még nincs termék.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Név</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tervező</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Variánsok</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Állapot</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{product.slug}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {product.mockupType === "tshirt"
                        ? "Póló"
                        : product.mockupType === "mug"
                          ? "Bögre"
                          : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{product.variants.length} db</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          product.active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {product.active ? "Aktív" : "Inaktív"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Szerkesztés
                        </Link>
                        <ProductToggleButton
                          productId={product.id}
                          active={product.active}
                        />
                      </div>
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
