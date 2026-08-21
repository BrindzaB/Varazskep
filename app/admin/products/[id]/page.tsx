import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import ProductForm from "@/components/admin/ProductForm";
import VariantManager from "@/components/admin/VariantManager";
import { getProductByIdAdmin } from "@/lib/services/product";
import { COLOR_MAP } from "@/lib/utils/colors";

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

        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">Variánsok</h2>
          <p className="mb-4 text-xs text-gray-500">
            Szín / méret kombinációk árral, készlettel és csomagsúllyal. Legalább
            egy variáns kell ahhoz, hogy a termék megvásárolható legyen.
          </p>
          <VariantManager
            productId={product.id}
            initialVariants={product.variants.map((v) => ({
              id: v.id,
              color: v.color,
              size: v.size,
              price: v.price,
              stock: v.stock,
              weightGrams: v.weightGrams,
            }))}
            colorSuggestions={Object.keys(COLOR_MAP)}
          />
        </div>
      </main>
    </div>
  );
}
