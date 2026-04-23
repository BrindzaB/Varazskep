"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatHuf } from "@/lib/utils/format";
import { COLOR_MAP } from "@/lib/utils/colors";
import { useCartStore } from "@/lib/cart/cartStore";
import type { ProductWithVariants } from "@/lib/services/product";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort(
    (a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b),
  );
}

interface ProductDetailsProps {
  product: ProductWithVariants;
  onColorChange?: (color: string) => void;
}

export default function ProductDetails({ product, onColorChange }: ProductDetailsProps) {
  const { variants } = product;
  const addItem = useCartStore((state) => state.addItem);
  const router = useRouter();

  // Unique colors in the order they appear
  const colors = Array.from(new Set(variants.map((v) => v.color)));

  const [selectedColor, setSelectedColor] = useState(colors[0] ?? "");

  // Sizes available for the selected color, always in S→XXL order
  const sizesForColor = sortSizes(
    variants.filter((v) => v.color === selectedColor).map((v) => v.size),
  );

  const [selectedSize, setSelectedSize] = useState(sizesForColor[0] ?? "");

  // When color changes, reset size to the first available for that color
  function handleColorChange(color: string) {
    setSelectedColor(color);
    const firstSize = variants.find((v) => v.color === color)?.size ?? "";
    setSelectedSize(firstSize);
    onColorChange?.(color);
  }

  // The specific variant matching the current selection
  const selectedVariant =
    variants.find(
      (v) => v.color === selectedColor && v.size === selectedSize
    ) ?? null;

  const isInStock = selectedVariant ? selectedVariant.stock > 0 : false;

  // URL for the designer with product context pre-loaded
  const designerUrl = `/designer?slug=${product.slug}&color=${encodeURIComponent(selectedColor)}&size=${encodeURIComponent(selectedSize)}`;

  return (
    <div className="flex flex-col">
      <h1 className="text-3xl font-bold text-charcoal">{product.name}</h1>

      {/* Price */}
      <p className="mt-3 text-2xl font-semibold text-charcoal">
        {selectedVariant ? formatHuf(selectedVariant.price) : "—"}
      </p>

      {product.description && (
        <ul className="mt-4 space-y-1">
          {product.description.split(",").map((item) => item.trim()).filter(Boolean).map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-md text-muted">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted" />
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 space-y-6">
        {/* Color selector */}
        {colors.length > 1 && (
          <div>
            <p className="mb-3 text-sm font-medium text-charcoal">
              Szín:{" "}
              <span className="font-normal text-muted">{selectedColor}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => {
                const bg = COLOR_MAP[color] ?? "#e9ecef";
                const isSelected = color === selectedColor;
                return (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    aria-label={color}
                    aria-pressed={isSelected}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      isSelected
                        ? "border-charcoal ring-2 ring-charcoal ring-offset-2"
                        : "border-border-medium hover:border-charcoal"
                    }`}
                    style={{ backgroundColor: bg }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Size selector */}
        <div>
          <p className="mb-3 text-sm font-medium text-charcoal">Méret</p>
          <div className="flex flex-wrap gap-2">
            {sizesForColor.map((size) => {
              const isSelected = size === selectedSize;
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  aria-pressed={isSelected}
                  className={`rounded-sm border px-4 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-border-medium text-charcoal hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stock warning */}
      {selectedVariant && !isInStock && (
        <p className="mt-4 text-sm text-error">
          Ez a méret jelenleg nem elérhető.
        </p>
      )}

      {/* CTAs */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          disabled={!isInStock || !selectedVariant}
          onClick={() => {
            if (!selectedVariant) return;
            addItem({
              source: "local",
              variantId: selectedVariant.id,
              productName: product.name,
              productSlug: product.slug,
              colorName: selectedColor,
              sizeName: selectedSize,
              price: selectedVariant.price,
              imageUrl: product.imageUrl ?? null,
            });
            router.push("/cart");
          }}
          className="flex-1 rounded-sm bg-brand-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-violet disabled:cursor-not-allowed disabled:opacity-50"
        >
          Kosárba
        </button>

        {/* Only shown for products that have a designer mockup */}
        {product.mockupType && (
          <Link
            href={designerUrl}
            className="flex-1 rounded-sm border border-brand-violet px-6 py-3 text-center text-sm font-semibold text-brand-violet transition-colors hover:bg-brand-violet hover:text-white"
          >
            Tervezőfelület megnyitása
          </Link>
        )}
      </div>
    </div>
  );
}
