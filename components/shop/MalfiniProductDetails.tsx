"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatHuf } from "@/lib/utils/format";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";
import { useCartStore } from "@/lib/cart/cartStore";
import type { MalfiniProduct, MalfiniVariant, MalfiniNomenclature } from "@/lib/malfini/types";
import { sortNomenclatures } from "@/lib/malfini/sizeOrder";

interface MalfiniProductDetailsProps {
  product: MalfiniProduct;
  priceMap: Record<string, number>;       // productSizeCode → HUF
  availabilityMap: Record<string, number>; // productSizeCode → quantity
}

export default function MalfiniProductDetails({
  product,
  priceMap,
  availabilityMap,
}: MalfiniProductDetailsProps) {
  const addItem = useCartStore((state) => state.addItem);
  const router = useRouter();

  // Only show variants that have a front image.
  const variantsWithImage = product.variants.filter((v) =>
    v.images.some((i) => i.viewCode === "a"),
  );

  const firstVariant = variantsWithImage[0] ?? product.variants[0];

  const [selectedVariantCode, setSelectedVariantCode] = useState(
    firstVariant?.code ?? "",
  );
  const [selectedSizeCode, setSelectedSizeCode] = useState(
    firstVariant?.nomenclatures[0]?.sizeCode ?? "",
  );

  // Derived from state.
  const selectedVariant: MalfiniVariant =
    product.variants.find((v) => v.code === selectedVariantCode) ??
    product.variants[0];

  const selectedNomenclature: MalfiniNomenclature =
    selectedVariant.nomenclatures.find(
      (n) => n.sizeCode === selectedSizeCode,
    ) ?? selectedVariant.nomenclatures[0];

  const price = priceMap[selectedNomenclature?.productSizeCode ?? ""] ?? 0;
  const inStock =
    (availabilityMap[selectedNomenclature?.productSizeCode ?? ""] ?? 0) > 0;

  // Front image of the selected color variant.
  const imageUrl =
    selectedVariant.images.find((i) => i.viewCode === "a")?.link ?? null;

  function handleVariantChange(variantCode: string) {
    const newVariant = product.variants.find((v) => v.code === variantCode);
    if (!newVariant) return;

    setSelectedVariantCode(variantCode);
    // Keep the same size if it exists in the new variant, otherwise reset.
    const hasSameSize = newVariant.nomenclatures.some(
      (n) => n.sizeCode === selectedSizeCode,
    );
    if (!hasSameSize) {
      setSelectedSizeCode(newVariant.nomenclatures[0]?.sizeCode ?? "");
    }
  }

  const hasDesigner = getCategoryConfig(product.categoryCode) !== null;
  const designerUrl = `/designer?code=${product.code}&colorCode=${encodeURIComponent(selectedVariant.code)}&sizeCode=${encodeURIComponent(selectedNomenclature?.sizeCode ?? "")}`;

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
      {/* Product image */}
      <div className="aspect-square w-full overflow-hidden rounded border border-border-light bg-white">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`${product.name} – ${selectedVariant.name}`}
            className="h-full w-full object-contain p-4"
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

      {/* Details */}
      <div className="flex flex-col">
        <h1 className="text-3xl font-bold text-charcoal">
          <span className="block font-mono text-sm font-normal text-muted mb-1">{product.code}</span>
          {product.name}
        </h1>

        {/* Price */}
        <p className="mt-3 text-2xl font-semibold text-charcoal">
          {price > 0 ? formatHuf(price) : "—"}
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
          {/* Color swatches */}
          {variantsWithImage.length > 1 && (
            <div>
              <p className="mb-3 text-sm font-medium text-charcoal">
                Szín:{" "}
                <span className="font-normal text-muted">
                  {selectedVariant.name}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {variantsWithImage.map((variant) => {
                  const isSelected = variant.code === selectedVariantCode;
                  return (
                    <button
                      key={variant.code}
                      onClick={() => handleVariantChange(variant.code)}
                      aria-label={variant.name}
                      aria-pressed={isSelected}
                      className={`h-8 w-8 overflow-hidden rounded-full border-2 transition-all ${
                        isSelected
                          ? "border-charcoal ring-2 ring-charcoal ring-offset-2"
                          : "border-border-medium hover:border-charcoal"
                      }`}
                    >
                      {/* Malfini color swatches are icon images, not hex — no inline style needed */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={variant.colorIconLink}
                        alt={variant.name}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size selector */}
          <div>
            <p className="mb-3 text-sm font-medium text-charcoal">Méret</p>
            <div className="flex flex-wrap gap-2">
              {sortNomenclatures(selectedVariant.nomenclatures).map((nom) => {
                const isSelected = nom.sizeCode === selectedSizeCode;
                const nomInStock = (availabilityMap[nom.productSizeCode] ?? 0) > 0;
                return (
                  <button
                    key={nom.sizeCode}
                    onClick={() => setSelectedSizeCode(nom.sizeCode)}
                    aria-pressed={isSelected}
                    disabled={!nomInStock}
                    className={`rounded-sm border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
                      isSelected
                        ? "border-brand-blue bg-brand-blue text-white"
                        : "border-border-medium text-charcoal hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed"
                    }`}
                  >
                    {nom.sizeName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Out-of-stock warning */}
        {!inStock && selectedNomenclature && (
          <p className="mt-4 text-sm text-error">
            Ez a méret jelenleg nem elérhető.
          </p>
        )}

        {/* CTAs */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            disabled={!inStock || !selectedNomenclature}
            onClick={() => {
              if (!selectedNomenclature) return;
              addItem({
                source: "malfini",
                productCode: product.code,
                productSizeCode: selectedNomenclature.productSizeCode,
                productName: product.name,
                colorName: selectedVariant.name,
                sizeName: selectedNomenclature.sizeName,
                price,
                imageUrl:
                  selectedVariant.images.find((i) => i.viewCode === "a")
                    ?.link ?? null,
              });
              router.push("/cart");
            }}
            className="flex-1 rounded-sm bg-brand-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-violet disabled:cursor-not-allowed disabled:opacity-50"
          >
            Kosárba
          </button>

          {hasDesigner && (
            <Link
              href={designerUrl}
              className="flex-1 rounded-sm border border-brand-violet px-6 py-3 text-center text-sm font-semibold text-brand-violet transition-colors hover:bg-brand-violet hover:text-white"
            >
              Tervezőfelület megnyitása
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
