"use client";

import { useState } from "react";
import ProductDetails from "./ProductDetails";
import type { ProductWithVariants } from "@/lib/services/product";

interface ProductDetailWrapperProps {
  product: ProductWithVariants;
  colorImages: Record<string, string>;
}

export default function ProductDetailWrapper({
  product,
  colorImages,
}: ProductDetailWrapperProps) {
  const firstColor = product.variants[0]?.color ?? "";
  const [displayImageUrl, setDisplayImageUrl] = useState(
    colorImages[firstColor] ?? product.imageUrl ?? "",
  );

  function handleColorChange(color: string) {
    const img = colorImages[color];
    if (img) setDisplayImageUrl(img);
  }

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
      <div className="aspect-square w-full overflow-hidden rounded border border-border-light bg-white">
        {displayImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImageUrl}
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

      <ProductDetails product={product} onColorChange={handleColorChange} />
    </div>
  );
}
