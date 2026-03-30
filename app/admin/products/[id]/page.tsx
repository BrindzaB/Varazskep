import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import ProductForm from "@/components/admin/ProductForm";
import { getProductByIdAdmin } from "@/lib/services/product";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProductByIdAdmin(params.id);
  if (!product) notFound();

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
          <span className="text-sm text-gray-600">{product.name}</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Termék szerkesztése</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <ProductForm
            productId={product.id}
            initialValues={{
              name: product.name,
              slug: product.slug,
              description: product.description ?? "",
              imageUrl: product.imageUrl ?? "",
              mockupType: product.mockupType ?? "",
              active: product.active,
            }}
          />
        </div>
      </main>
    </div>
  );
}
