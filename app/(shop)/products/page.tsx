import ProductGrid from "@/components/shop/ProductGrid";
import { getActiveProducts } from "@/lib/services/product";

export const metadata = {
  title: "Termékek – Varázskép",
  description: "Egyedi pólók és bögrék – válasszon termékeink közül.",
};

export default async function ProductsPage() {
  const products = await getActiveProducts();

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-layout">
        <h1 className="mb-8 text-3xl font-bold text-charcoal">Termékek</h1>
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
