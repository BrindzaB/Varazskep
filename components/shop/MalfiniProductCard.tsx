import Link from "next/link";
import { formatHuf } from "@/lib/utils/format";
import type { MalfiniProduct } from "@/lib/malfini/types";

interface MalfiniProductCardProps {
  product: MalfiniProduct;
  minPrice: number;
}

export default function MalfiniProductCard({
  product,
  minPrice,
}: MalfiniProductCardProps) {
  // Use the first variant that has a front image — not necessarily the first variant.
  const firstVariantWithImage = product.variants.find((v) =>
    v.images.some((i) => i.viewCode === "a"),
  );
  const imageUrl =
    firstVariantWithImage?.images.find((i) => i.viewCode === "a")?.link ?? null;

  return (
    <Link
      href={`/products/malfini/${product.code}`}
      className="group flex flex-col overflow-hidden rounded border border-border-light bg-white transition-shadow hover:shadow-card"
    >
      {/* Product image — 1:1 aspect ratio */}
      <div className="relative aspect-square w-full overflow-hidden bg-white">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
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
        <h2 className="line-clamp-2 text-base font-semibold text-charcoal">
          {product.name}
        </h2>

        <div className="mt-auto flex items-center justify-between pt-4">
          <p className="text-sm font-medium text-charcoal">
            {minPrice > 0 ? (
              <>
                {formatHuf(minPrice)}
                <span className="ml-1 font-normal text-muted">-tól</span>
              </>
            ) : (
              "—"
            )}
          </p>

          <span className="rounded-sm bg-charcoal px-3 py-1.5 text-xs font-medium text-white transition-colors group-hover:bg-charcoal-dark">
            Megnézem
          </span>
        </div>
      </div>
    </Link>
  );
}
