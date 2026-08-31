import type { Metadata } from "next";
import { getActiveProducts } from "@/lib/services/product";
import { getProducts } from "@/lib/malfini/client";
import { getMalfiniPriceMap } from "@/lib/pricing/resolve";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";
import ProductsPageClient from "@/components/shop/ProductsPageClient";

export const revalidate = 300; // Re-validate every 5 minutes (matches Malfini price cache)

export const metadata: Metadata = {
  title: "Termékek – Varázskép",
  description: "Egyedi pólók és bögrék – válasszon termékeink közül.",
};

export default async function ProductsPage() {
  const [allMalfiniProducts, localProducts] = await Promise.all([
    getProducts("hu"),
    getActiveProducts(),
  ]);

  // Keep only categories that have a designer config (t-shirts + sweatshirts for Phase 6).
  const clothingProducts = allMalfiniProducts.filter(
    (p) =>
      getCategoryConfig(p.categoryCode) !== null &&
      p.variants.some((v) => v.images.some((i) => i.viewCode === "a"))
  );

  // The card shows a single "X Ft-tól" label, so only the representative SKU of
  // each product needs a price — the first variant's first size.
  const reprSkus = clothingProducts.map(
    (p) => p.variants[0]?.nomenclatures[0]?.productSizeCode ?? ""
  );
  const priceMap = await getMalfiniPriceMap(reprSkus.filter(Boolean));

  const clothingWithPrices = clothingProducts.map((p, i) => ({
    ...p,
    minPrice: priceMap[reprSkus[i]] ?? 0,
  }));

  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-layout">
        <h1 className="mb-8 text-2xl font-bold uppercase text-brand-blue">
          Termékek
        </h1>
        <ProductsPageClient
          clothingProducts={clothingWithPrices}
          localProducts={localProducts}
        />
      </div>
    </section>
  );
}
