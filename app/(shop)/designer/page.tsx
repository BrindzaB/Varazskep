import { redirect } from "next/navigation";
import type { Metadata } from "next";
import DesignerLayout from "@/components/designer/DesignerLayout";
import { getProductBySlug } from "@/lib/services/product";
import {
  getProduct,
  getRecommendedPrices,
  getAvailabilities,
  buildPriceMap,
  buildAvailabilityMap,
} from "@/lib/malfini/client";
import { convertEurToHuf } from "@/lib/malfini/pricing";

export const metadata: Metadata = {
  title: "Tervező – Varázskép",
  description: "Tervezd meg egyedi termékedet a Varázskép online tervezőjével.",
};

interface Props {
  searchParams: {
    // Malfini mode
    code?: string;
    colorCode?: string;
    sizeCode?: string;
    // Local mode
    slug?: string;
    color?: string;
    size?: string;
  };
}

export default async function DesignerPage({ searchParams }: Props) {
  // ── Malfini mode: ?code=M150&colorCode=01&sizeCode=M ──────────────────────
  if (searchParams.code) {
    const product = await getProduct(searchParams.code, "hu");
    if (!product) redirect("/products");

    // Resolve variant: match by colorCode, fall back to first with a front image
    const variant =
      product.variants.find((v) => v.code === searchParams.colorCode) ??
      product.variants.find((v) => v.images.some((i) => i.viewCode === "a")) ??
      product.variants[0];

    if (!variant) redirect("/products");

    // Resolve nomenclature: match by sizeCode, fall back to first
    const nomenclature =
      variant.nomenclatures.find((n) => n.sizeCode === searchParams.sizeCode) ??
      variant.nomenclatures[0];

    if (!nomenclature) redirect("/products");

    const [prices, availabilities] = await Promise.all([
      getRecommendedPrices([product.code]),
      getAvailabilities([product.code]),
    ]);
    const priceMap = buildPriceMap(prices, convertEurToHuf);
    const availabilityMap = buildAvailabilityMap(availabilities);

    return (
      <DesignerLayout
        source="malfini"
        malfiniProduct={product}
        initialVariant={variant}
        initialNomenclature={nomenclature}
        priceMap={priceMap}
        availabilityMap={availabilityMap}
      />
    );
  }

  // ── Local mode: ?slug=egyedi-bogre&color=Fehér&size=330ml ─────────────────
  const slug = searchParams.slug ?? "egyedi-polo";

  let product = await getProductBySlug(slug);
  if (!product || !product.mockupType) {
    product = await getProductBySlug("egyedi-polo");
  }

  if (!product || !product.mockupType) {
    redirect("/products");
  }

  const availableColors = Array.from(new Set(product.variants.map((v) => v.color)));
  const initialColor = availableColors.includes(searchParams.color ?? "")
    ? searchParams.color!
    : (availableColors[0] ?? "");

  const sizesForColor = product.variants
    .filter((v) => v.color === initialColor)
    .map((v) => v.size);
  const initialSize = sizesForColor.includes(searchParams.size ?? "")
    ? searchParams.size!
    : (sizesForColor[0] ?? "");

  return (
    <DesignerLayout
      source="local"
      product={product}
      initialColor={initialColor}
      initialSize={initialSize}
    />
  );
}
