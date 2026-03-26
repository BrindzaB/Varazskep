import Link from "next/link";
import { formatHuf, getMinPrice } from "@/lib/services/product";
import type { ProductWithVariants } from "@/lib/services/product";

interface ProductCardProps {
  product: ProductWithVariants;
}

export default function ProductCard({ product }: ProductCardProps) {
  const minPrice = getMinPrice(product.variants);

  return (
    <Link
      href={`/termekek/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded border border-border-light bg-white transition-shadow hover:shadow-card"
    >
      {/* Product image — 1:1 aspect ratio */}
      <div className="relative aspect-square w-full overflow-hidden bg-off-white">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          // Placeholder shown until real product photos are uploaded
          <div className="flex h-full w-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
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

      {/* Card body */}
      <div className="flex flex-1 flex-col p-4">
        <h2 className="text-base font-semibold text-charcoal">
          {product.name}
        </h2>

        {product.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted">
            {product.description}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-medium text-charcoal">
            {formatHuf(minPrice)}
            {product.variants.length > 1 && (
              <span className="ml-1 font-normal text-muted">-tól</span>
            )}
          </p>

          {/* Visual CTA — actual navigation handled by the wrapping Link */}
          <span className="rounded-sm bg-charcoal px-3 py-1.5 text-xs font-medium text-white transition-colors group-hover:bg-charcoal-dark">
            Megnézem
          </span>
        </div>
      </div>
    </Link>
  );
}
