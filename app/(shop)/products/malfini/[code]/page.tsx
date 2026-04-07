import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProduct,
  getRecommendedPrices,
  getAvailabilities,
  buildPriceMap,
  buildAvailabilityMap,
} from "@/lib/malfini/client";
import { convertEurToHuf } from "@/lib/malfini/pricing";
import MalfiniProductDetails from "@/components/shop/MalfiniProductDetails";

interface Props {
  params: { code: string };
}

// Rendered at request time — module-level catalog cache (~10MB) exceeds
// Next.js's 2MB static generation limit, so ISR / generateStaticParams are not viable.
export const dynamic = "force-dynamic";

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
