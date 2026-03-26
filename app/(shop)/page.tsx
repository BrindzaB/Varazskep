import ProductGrid from "@/components/shop/ProductGrid";
import { getActiveProducts } from "@/lib/services/product";

export const metadata = {
  title: "Varázskép – Egyedi ajándékok",
  description:
    "Tervezze meg saját egyedi pólóját vagy bögrét! Prémium minőség, gyors szállítás.",
};

export default async function HomePage() {
  const products = await getActiveProducts();

  return (
    <>
      {/* Hero */}
      <section className="bg-charcoal px-4 py-16 text-white">
        <div className="mx-auto max-w-layout">
          <h1 className="text-balance text-4xl font-bold">
            Egyedi ajándékok, <br className="hidden sm:block" />
            tervezve általad
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/80">
            Tervezze meg saját pólóját vagy bögrét a beépített tervezőfelületen.
            Prémium minőség, egyedi minta, gyors szállítás.
          </p>
          <a
            href="/designer"
            className="mt-8 inline-block rounded-sm bg-white px-6 py-3 text-sm font-semibold text-charcoal transition-colors hover:bg-off-white"
          >
            Tervezés megkezdése
          </a>
        </div>
      </section>

      {/* Product listing */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-layout">
          <h2 className="mb-8 text-2xl font-semibold text-charcoal">
            Termékeink
          </h2>
          <ProductGrid products={products} />
        </div>
      </section>
    </>
  );
}
