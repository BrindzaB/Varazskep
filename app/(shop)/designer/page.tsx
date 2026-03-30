import { redirect } from "next/navigation";
import type { Metadata } from "next";
import DesignerLayout from "@/components/designer/DesignerLayout";
import { getProductBySlug } from "@/lib/services/product";

export const metadata: Metadata = {
  title: "Tervező – Varázskép",
  description: "Tervezd meg egyedi termékedet a Varázskép online tervezőjével.",
};

interface Props {
  searchParams: { slug?: string; color?: string; size?: string };
}

export default async function DesignerPage({ searchParams }: Props) {
  const slug = searchParams.slug ?? "egyedi-polo";

  // Try the requested product first, fall back to the default t-shirt
  let product = await getProductBySlug(slug);
  if (!product || !product.mockupType) {
    product = await getProductBySlug("egyedi-polo");
  }

  // If even the default product is missing a mockupType, bail to the product list
  if (!product || !product.mockupType) {
    redirect("/products");
  }

  // Resolve initial color: use URL param if it matches an available variant color,
  // otherwise fall back to the first color in the product's variant list
  const availableColors = Array.from(new Set(product.variants.map((v) => v.color)));
  const initialColor = availableColors.includes(searchParams.color ?? "")
    ? searchParams.color!
    : (availableColors[0] ?? "");

  // Resolve initial size: use URL param if it's available for that color,
  // otherwise fall back to the first size for that color
  const sizesForColor = product.variants
    .filter((v) => v.color === initialColor)
    .map((v) => v.size);
  const initialSize = sizesForColor.includes(searchParams.size ?? "")
    ? searchParams.size!
    : (sizesForColor[0] ?? "");

  return (
    <DesignerLayout
      product={product}
      initialColor={initialColor}
      initialSize={initialSize}
    />
  );
}
