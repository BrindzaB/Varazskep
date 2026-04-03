import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProduct,
  getProducts,
  getRecommendedPrices,
  getAvailabilities,
  buildPriceMap,
  buildAvailabilityMap,
} from "@/lib/malfini/client";
import { convertEurToHuf } from "@/lib/malfini/pricing";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";
import MalfiniProductDetails from "@/components/shop/MalfiniProductDetails";

interface Props {
  params: { code: string };
}

// Pre-render all configured category product pages at build time.
export async function generateStaticParams() {
  const products = await getProducts("hu");
  return products
    .filter(
      (p) =>
        getCategoryConfig(p.categoryCode) !== null &&
        p.variants.some((v) => v.images.some((i) => i.viewCode === "a")),
    )
    .map((p) => ({ code: p.code }));
}

export const revalidate = 300; // Re-validate every 5 minutes (ISR)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.code, "hu");
  if (!product) return {};
  return {
    title: `${product.name} – Varázskép`,
    description: product.description,
  };
}

export default async function MalfiniProductPage({ params }: Props) {
  const product = await getProduct(params.code, "hu");
  if (!product) notFound();

  // Pass the 3-char product code — the API returns all nomenclature prices/availabilities for it.
  const [prices, availabilities] = await Promise.all([
    getRecommendedPrices([product.code]),
    getAvailabilities([product.code]),
  ]);

  const priceMap = buildPriceMap(prices, convertEurToHuf);
  const availabilityMap = buildAvailabilityMap(availabilities);

  return (
    <div className="mx-auto max-w-layout px-4 py-16">
      <MalfiniProductDetails
        product={product}
        priceMap={priceMap}
        availabilityMap={availabilityMap}
      />
    </div>
  );
}
