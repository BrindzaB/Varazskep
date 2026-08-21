import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import ProductDeleteButton from "@/components/admin/ProductDeleteButton";
import { PencilIcon } from "@/components/admin/icons";
import { getAllProductsAdmin } from "@/lib/services/product";
import { getMockupLabel } from "@/lib/designer/mockupConfig";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await getAllProductsAdmin();

  return (
    <div>
      <AdminNav />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">Termékek</h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/admin/products/malfini"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:px-4 sm:py-2 sm:text-sm"
            >
              Malfini katalógus
            </Link>
            <Link
              href="/admin/products/new"
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 sm:px-4 sm:py-2 sm:text-sm"
            >
              + Új termék
            </Link>
          </div>
        </div>

        {products.length === 0 ? (
          <p className="text-gray-500">Még nincs termék.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Név</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kategória</th>
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
                    <td className="px-4 py-3 text-gray-600">{product.category ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {getMockupLabel(product.mockupType) ?? "—"}
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
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          href={`/admin/products/${product.id}`}
                          title="Szerkesztés"
                          aria-label={`„${product.name}” szerkesztése`}
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                        <ProductDeleteButton
                          productId={product.id}
                          productName={product.name}
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
