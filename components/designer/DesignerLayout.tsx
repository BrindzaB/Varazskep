"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DesignerCanvas, { type DesignerCanvasRef } from "./DesignerCanvas";
import ColorPicker, { type ColorEntry } from "./ColorPicker";
import ClipartPanel from "./ClipartPanel";
import TextOptionsBar, { DEFAULT_TEXT_FONT, DEFAULT_TEXT_COLOR } from "./TextOptionsBar";
import { COLOR_MAP } from "@/lib/utils/colors";
import { getMockupConfig } from "@/lib/designer/mockupConfig";
import { useCartStore } from "@/lib/cart/cartStore";
import { formatHuf } from "@/lib/utils/format";
import type { ProductWithVariants } from "@/lib/services/product";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

interface DesignerLayoutProps {
  product: ProductWithVariants;
  initialColor: string; // Hungarian color name
  initialSize: string;
}

export default function DesignerLayout({
  product,
  initialColor,
  initialSize,
}: DesignerLayoutProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const mockupConfig = getMockupConfig(product.mockupType ?? null);

  // Build the list of swatchable colors from the product's variants
  const availableColors: ColorEntry[] = Array.from(
    new Set(product.variants.map((v) => v.color)),
  ).map((name) => ({ name, hex: COLOR_MAP[name] ?? "#9ca3af" }));

  // ── Designer state ───────────────────────────────────────────────────────
  const [shirtColorName, setShirtColorName] = useState(initialColor);
  const shirtColorHex = COLOR_MAP[shirtColorName] ?? "#9ca3af";

  const [side, setSide] = useState<"front" | "back">("front");
  const [isClipartOpen, setIsClipartOpen] = useState(false);

  // Text tool state — drives TextOptionsBar visibility and its selected values
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [activeFont, setActiveFont] = useState<string>(DEFAULT_TEXT_FONT);
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_TEXT_COLOR);

  // ── Right panel state ────────────────────────────────────────────────────
  // Sizes available for the currently selected color, in canonical order
  const sizesForColor = product.variants
    .filter((v) => v.color === shirtColorName)
    .map((v) => v.size)
    .sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));

  const [selectedSize, setSelectedSize] = useState(initialSize);

  const selectedVariant =
    product.variants.find(
      (v) => v.color === shirtColorName && v.size === selectedSize,
    ) ?? null;
  const isInStock = selectedVariant ? selectedVariant.stock > 0 : false;

  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addToCartError, setAddToCartError] = useState<string | null>(null);

  // ── Canvas ref ───────────────────────────────────────────────────────────
  const canvasRef = useRef<DesignerCanvasRef>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleClipartSelect(svgUrl: string) {
    canvasRef.current?.addClipart(svgUrl);
  }

  function handleColorChange(name: string, hex: string) {
    setShirtColorName(name);
    // Reset size to the first available size for the new color
    const firstSize = product.variants.find((v) => v.color === name)?.size ?? "";
    setSelectedSize(firstSize);
    // hex is already the correct value — suppress unused-var lint
    void hex;
  }

  function handleActiveTextChange(isText: boolean, font: string, color: string) {
    setIsTextSelected(isText);
    if (isText) {
      setActiveFont(font);
      setActiveColor(color);
    }
  }

  function handleFontChange(font: string) {
    setActiveFont(font);
    canvasRef.current?.setTextFont(font);
  }

  function handleTextColorChange(color: string) {
    setActiveColor(color);
    canvasRef.current?.setTextColor(color);
  }

  async function handleAddToCart() {
    if (!selectedVariant || !isInStock || isAddingToCart) return;
    setIsAddingToCart(true);
    setAddToCartError(null);

    try {
      const canvasData = canvasRef.current?.getCanvasJson() ?? { front: [], back: [] };

      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasJson: canvasData }),
      });

      if (!res.ok) throw new Error("Design save failed");

      const { id: designId } = (await res.json()) as { id: string };

      addItem({
        variantId: selectedVariant.id,
        productName: product.name,
        productSlug: product.slug,
        color: shirtColorName,
        size: selectedSize,
        price: selectedVariant.price,
        imageUrl: product.imageUrl ?? null,
        designId,
      });

      router.push("/cart");
    } catch {
      setAddToCartError("Hiba történt a mentés során. Kérem, próbálja újra.");
    } finally {
      setIsAddingToCart(false);
    }
  }

  return (
    <div className="flex bg-off-white">
      {/* Left toolbar */}
      <aside className="hidden w-20 flex-shrink-0 flex-col items-center gap-6 bg-charcoal py-6 lg:flex">
        {/* Back to products */}
        <Link
          href="/products"
          title="Vissza a termékekhez"
          aria-label="Vissza a termékekhez"
          className="flex flex-col items-center gap-1 text-white/60 transition-colors hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          <span className="text-xs font-medium">Termékek</span>
        </Link>

        <div className="w-10 border-t border-white/20" />

        <ColorPicker
          colors={availableColors}
          selectedColor={shirtColorHex}
          onChange={handleColorChange}
        />

        <div className="w-10 border-t border-white/20" />

        {/* Clipart button */}
        <button
          onClick={() => setIsClipartOpen(true)}
          title="Motívumok"
          aria-label="Motívumok megnyitása"
          className="flex flex-col items-center gap-1 text-white/60 transition-colors hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="text-xs font-medium">Motívum</span>
        </button>

        <div className="w-10 border-t border-white/20" />

        {/* Text tool button */}
        <button
          onClick={() => canvasRef.current?.addText()}
          title="Szöveg hozzáadása"
          aria-label="Szöveg hozzáadása"
          className="flex flex-col items-center gap-1 text-white/60 transition-colors hover:text-white"
        >
          <span className="text-2xl font-bold leading-none" aria-hidden="true">
            T
          </span>
          <span className="text-xs font-medium">Szöveg</span>
        </button>
      </aside>

      {/* Canvas area */}
      <div className="flex flex-1 flex-col items-center overflow-auto px-4 py-8 lg:px-8 lg:py-10">
        <DesignerCanvas
          ref={canvasRef}
          shirtColor={shirtColorHex}
          side={side}
          mockupType={product.mockupType ?? undefined}
          onActiveTextChange={handleActiveTextChange}
        />

        {/* Text options bar — visible only when a text object is selected */}
        {isTextSelected && (
          <div className="mt-3">
            <TextOptionsBar
              currentFont={activeFont}
              currentColor={activeColor}
              onFontChange={handleFontChange}
              onColorChange={handleTextColorChange}
            />
          </div>
        )}

        {/* Front / back toggle — only shown for products with two sides */}
        {mockupConfig.hasSides && (
          <div className="mt-3 flex rounded-lg border border-border-light bg-white p-1 shadow-card">
            <button
              onClick={() => setSide("front")}
              aria-pressed={side === "front"}
              className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
                side === "front"
                  ? "bg-charcoal text-white"
                  : "text-muted hover:text-charcoal"
              }`}
            >
              Elől
            </button>
            <button
              onClick={() => setSide("back")}
              aria-pressed={side === "back"}
              className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
                side === "back"
                  ? "bg-charcoal text-white"
                  : "text-muted hover:text-charcoal"
              }`}
            >
              Hátul
            </button>
          </div>
        )}
      </div>

      {/* Right summary panel */}
      <aside className="hidden w-72 flex-shrink-0 flex-col border-l border-border-light bg-white p-6 lg:flex">
        <h2 className="text-lg font-semibold text-charcoal">{product.name}</h2>

        {/* Selected color */}
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-charcoal">
            Szín:{" "}
            <span className="font-normal text-muted">{shirtColorName}</span>
          </p>
        </div>

        {/* Size selector */}
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-charcoal">Méret</p>
          <div className="flex flex-wrap gap-2">
            {sizesForColor.map((size) => {
              const isSelected = size === selectedSize;
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  aria-pressed={isSelected}
                  className={`rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-charcoal bg-charcoal text-white"
                      : "border-border-medium text-charcoal hover:border-charcoal"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>

        {/* Price */}
        {selectedVariant && (
          <p className="mt-5 text-xl font-semibold text-charcoal">
            {formatHuf(selectedVariant.price)}
          </p>
        )}

        {/* Stock warning */}
        {selectedVariant && !isInStock && (
          <p className="mt-2 text-sm text-error">
            Ez a méret jelenleg nem elérhető.
          </p>
        )}

        {/* Error message */}
        {addToCartError && (
          <p className="mt-2 text-sm text-error">{addToCartError}</p>
        )}

        {/* Spacer pushes the button to the bottom */}
        <div className="flex-1" />

        <button
          onClick={handleAddToCart}
          disabled={!isInStock || !selectedVariant || isAddingToCart}
          className="mt-6 w-full rounded-sm bg-charcoal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAddingToCart ? "Mentés..." : "Kosárba"}
        </button>
      </aside>

      {/* Clipart modal */}
      {isClipartOpen && (
        <ClipartPanel
          onSelect={handleClipartSelect}
          onClose={() => setIsClipartOpen(false)}
        />
      )}
    </div>
  );
}
