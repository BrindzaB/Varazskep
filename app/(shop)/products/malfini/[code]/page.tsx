import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProduct,
  getAvailabilities,
  buildAvailabilityMap,
  malfiniProductSkus,
} from "@/lib/malfini/client";
import { getMalfiniPriceMap } from "@/lib/pricing/resolve";
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

  // Availabilities take the 3-char product code; pricing takes the SKUs it covers.
  const [priceMap, availabilities] = await Promise.all([
    getMalfiniPriceMap(malfiniProductSkus(product)),
    getAvailabilities([product.code]),
  ]);

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
