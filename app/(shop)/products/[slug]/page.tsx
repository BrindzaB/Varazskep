import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailWrapper from "@/components/shop/ProductDetailWrapper";
import { getAllProductSlugs, getProductBySlug } from "@/lib/services/product";

interface Props {
  params: { slug: string };
}

// Pre-render all active product pages at build time.
export async function generateStaticParams() {
  return getAllProductSlugs();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  if (!product) return {};
  return {
    title: `${product.name} – Varázskép`,
    description: product.description ?? undefined,
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const product = await getProductBySlug(params.slug);

  if (!product) notFound();

  // Per-colour images from the variants (DB). Empty map → the wrapper falls back
  // to product.imageUrl. One uniform layout for every local product.
  const colorImages: Record<string, string> = {};
  for (const v of product.variants) {
    if (v.imageUrl && !colorImages[v.color]) colorImages[v.color] = v.imageUrl;
  }

  return (
    <div className="mx-auto max-w-layout px-4 py-16">
      <ProductDetailWrapper product={product} colorImages={colorImages} />
    </div>
  );
}
