import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetails from "@/components/shop/ProductDetails";
import ProductDetailWrapper from "@/components/shop/ProductDetailWrapper";
import { getAllProductSlugs, getProductBySlug } from "@/lib/services/product";
import { getMockupConfig } from "@/lib/designer/mockupConfig";

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

  const colorImages = product.mockupType
    ? (getMockupConfig(product.mockupType).colorImages ?? null)
    : null;

  return (
    <div className="mx-auto max-w-layout px-4 py-16">
      {colorImages ? (
        <ProductDetailWrapper product={product} colorImages={colorImages} />
      ) : (
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Product image */}
          <div className="aspect-square w-full overflow-hidden rounded border border-border-light bg-white">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-border-medium"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}
          </div>

          {/* Variant selection and CTAs — client component */}
          <ProductDetails product={product} />
        </div>
      )}
    </div>
  );
}
