import type { Metadata } from "next";
import { getActiveProducts } from "@/lib/services/product";
import {
  getProducts,
  getRecommendedPrices,
  buildPriceMap,
} from "@/lib/malfini/client";
import { convertEurToHuf } from "@/lib/malfini/pricing";
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
      p.variants.some((v) => v.images.some((i) => i.viewCode === "a")),
  );

  // Pass 3-char product codes — the API filters by product code, not SKU.
  // Response contains all per-size prices; we look up the representative SKU for card display.
  const productCodes = clothingProducts.map((p) => p.code);

  const prices = await getRecommendedPrices(productCodes);
  const priceMap = buildPriceMap(prices, convertEurToHuf);

  // Attach the representative retail price to each product for the "X Ft-tól" card label.
  // Use the first variant's first nomenclature as the representative SKU.
  const clothingWithPrices = clothingProducts.map((p) => {
    const reprCode = p.variants[0]?.nomenclatures[0]?.productSizeCode ?? "";
    return { ...p, minPrice: priceMap[reprCode] ?? 0 };
  });

  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-layout">
        <h1 className="mb-8 text-2xl font-bold text-brand-blue uppercase">Termékek</h1>
        <ProductsPageClient
          clothingProducts={clothingWithPrices}
          localProducts={localProducts}
        />
      </div>
    </section>
  );
}
