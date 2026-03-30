import AdminNav from "@/components/admin/AdminNav";
import ProductForm from "@/components/admin/ProductForm";
import Link from "next/link";

export default function NewProductPage() {
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
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Új termék</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <ProductForm />
        </div>
      </main>
    </div>
  );
}
