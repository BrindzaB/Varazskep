"use client";

import { useState } from "react";
import Link from "next/link";
import { formatHuf, getMinPrice } from "@/lib/utils/format";
import { COLOR_MAP } from "@/lib/utils/colors";
import { getMockupConfig } from "@/lib/designer/mockupConfig";
import type { ProductWithVariants } from "@/lib/services/product";

interface ProductCardProps {
  product: ProductWithVariants;
}

export default function ProductCard({ product }: ProductCardProps) {
  const minPrice = getMinPrice(product.variants);
  const uniqueColors = Array.from(new Set(product.variants.map((v) => v.color)));
  const colorImages = product.mockupType
    ? (getMockupConfig(product.mockupType).colorImages ?? null)
    : null;

  const defaultImage = colorImages
    ? (colorImages[uniqueColors[0] ?? ""] ?? product.imageUrl ?? null)
    : (product.imageUrl ?? null);

  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(defaultImage);

  function handleSwatchEnter(color: string) {
    if (colorImages?.[color]) setDisplayImageUrl(colorImages[color]);
  }

  function handleSwatchLeave() {
    setDisplayImageUrl(defaultImage);
  }

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded border border-border-light bg-white transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-card"
    >
      {/* Product image — 1:1 aspect ratio */}
      <div className="relative aspect-square w-full overflow-hidden bg-white">
        {displayImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
        <h2 className="text-base font-semibold text-charcoal">
          {product.name}
        </h2>

        {/* Color swatches — max 4 visible, remainder shown as "+x" */}
        {uniqueColors.length > 0 && (
          <div className="mt-2 flex items-center gap-1">
            {uniqueColors.slice(0, 4).map((color) => (
              <span
                key={color}
                title={color}
                style={{ backgroundColor: COLOR_MAP[color] ?? "#9ca3af" }}
                className="h-4 w-4 rounded-full border border-border-light cursor-pointer"
                onMouseEnter={() => handleSwatchEnter(color)}
                onMouseLeave={handleSwatchLeave}
              />
            ))}
            {uniqueColors.length > 4 && (
              <span className="text-xs text-muted">+{uniqueColors.length - 4}</span>
            )}
          </div>
        )}

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

          <span className="rounded-sm bg-brand-blue px-3 py-1.5 text-xs font-medium text-white transition-colors group-hover:bg-brand-violet">
            Megnézem
          </span>
        </div>
      </div>
    </Link>
  );
}
