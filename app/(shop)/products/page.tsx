import type { Metadata } from "next";
import Link from "next/link";
import { getActiveProducts } from "@/lib/services/product";
import { getProducts } from "@/lib/malfini/client";
import { getMalfiniPriceMap } from "@/lib/pricing/resolve";
import { isStorefrontClothing } from "@/lib/malfini/storefront";
import { getPopularProductKeys } from "@/lib/services/popular";
import { getCategoryIcons } from "@/lib/services/categoryIcons";
import ProductsPageClient from "@/components/shop/ProductsPageClient";

export const revalidate = 300; // Re-validate every 5 minutes (matches Malfini price cache)

export const metadata: Metadata = {
  title: "Termékek – Varázskép",
  description: "Egyedi pólók és bögrék – válasszon termékeink közül.",
};

export default async function ProductsPage() {
  const [allMalfiniProducts, localProducts, popularKeys, categoryIcons] =
    await Promise.all([
      getProducts("hu"),
      getActiveProducts(),
      getPopularProductKeys(),
      getCategoryIcons(),
    ]);

  // Keep only categories that have a designer config, with a photo for the card.
  const clothingProducts = allMalfiniProducts.filter(isStorefrontClothing);

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
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold uppercase text-charcoal">
            Termékek
          </h1>
          {/* Alternative for larger (typically corporate) orders — kept secondary
              to the designer on purpose. */}
          <Link
            href="/megrendelo-lap"
            className="rounded-sm border border-charcoal px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-white"
          >
            Rendelés megrendelő lapon
          </Link>
        </div>
        <ProductsPageClient
          clothingProducts={clothingWithPrices}
          localProducts={localProducts}
          popularKeys={popularKeys}
          categoryIcons={categoryIcons}
        />
      </div>
    </section>
  );
}
