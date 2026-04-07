"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DesignerCanvas, { type DesignerCanvasRef } from "./DesignerCanvas";
import { type ColorEntry } from "./ColorPicker";
import ClipartPanel from "./ClipartPanel";
import TextOptionsBar, { DEFAULT_TEXT_FONT, DEFAULT_TEXT_COLOR } from "./TextOptionsBar";
import { COLOR_MAP } from "@/lib/utils/colors";
import { getMockupConfig } from "@/lib/designer/mockupConfig";
import { buildColoredDataUrl } from "@/lib/designer/colorUtils";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";
import { useCartStore } from "@/lib/cart/cartStore";
import { formatHuf } from "@/lib/utils/format";
import type { ProductWithVariants } from "@/lib/services/product";
import type { MalfiniProduct, MalfiniVariant, MalfiniNomenclature } from "@/lib/malfini/types";

// Malfini size ordering: adult sizes then kids numeric sizes
const SIZE_ORDER = [
  "3XS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL",
  "86", "92", "98", "104", "110", "116", "122", "128", "134", "140", "146", "152", "158", "164", "170",
];

function sortNomenclatures(nomenclatures: MalfiniNomenclature[]): MalfiniNomenclature[] {
  return [...nomenclatures].sort(
    (a, b) => SIZE_ORDER.indexOf(a.sizeCode) - SIZE_ORDER.indexOf(b.sizeCode),
  );
}

// ── Shared toolbar UI ─────────────────────────────────────────────────────────

interface ToolbarProps {
  onClipartOpen: () => void;
  onAddText: () => void;
}

function DesignerToolbar({
  onClipartOpen,
  onAddText,
}: ToolbarProps) {
  return (
    <aside className="hidden w-20 flex-shrink-0 flex-col items-center gap-6 bg-charcoal py-6 lg:flex">
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

      <button
        onClick={onClipartOpen}
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

      <button
        onClick={onAddText}
        title="Szöveg hozzáadása"
        aria-label="Szöveg hozzáadása"
        className="flex flex-col items-center gap-1 text-white/60 transition-colors hover:text-white"
      >
        <span className="text-2xl font-bold leading-none" aria-hidden="true">T</span>
        <span className="text-xs font-medium">Szöveg</span>
      </button>
    </aside>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

type LocalProps = {
  source: "local";
  product: ProductWithVariants;
  initialColor: string;
  initialSize: string;
};

type MalfiniProps = {
  source: "malfini";
  malfiniProduct: MalfiniProduct;
  initialVariant: MalfiniVariant;
  initialNomenclature: MalfiniNomenclature;
  priceMap: Record<string, number>;
  availabilityMap: Record<string, number>;
};

type DesignerLayoutProps = LocalProps | MalfiniProps;

export default function DesignerLayout(props: DesignerLayoutProps) {
  if (props.source === "malfini") return <MalfiniDesignerLayout {...props} />;
  return <LocalDesignerLayout {...props} />;
}

// ── Local mode ────────────────────────────────────────────────────────────────

const LOCAL_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function LocalDesignerLayout({ product, initialColor, initialSize }: LocalProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const mockupConfig = getMockupConfig(product.mockupType ?? null);

  const availableColors: ColorEntry[] = Array.from(
    new Set(product.variants.map((v) => v.color)),
  ).map((name) => ({ name, hex: COLOR_MAP[name] ?? "#9ca3af" }));

  const [shirtColorName, setShirtColorName] = useState(initialColor);
  const shirtColorHex = COLOR_MAP[shirtColorName] ?? "#9ca3af";

  const [side, setSide] = useState<"front" | "back">("front");
  const [isClipartOpen, setIsClipartOpen] = useState(false);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [activeFont, setActiveFont] = useState<string>(DEFAULT_TEXT_FONT);
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_TEXT_COLOR);

  const sizesForColor = product.variants
    .filter((v) => v.color === shirtColorName)
    .map((v) => v.size)
    .sort((a, b) => LOCAL_SIZE_ORDER.indexOf(a) - LOCAL_SIZE_ORDER.indexOf(b));

  const [selectedSize, setSelectedSize] = useState(initialSize);

  const selectedVariant =
    product.variants.find((v) => v.color === shirtColorName && v.size === selectedSize) ?? null;
  const isInStock = selectedVariant ? selectedVariant.stock > 0 : false;

  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addToCartError, setAddToCartError] = useState<string | null>(null);

  const canvasRef = useRef<DesignerCanvasRef>(null);

  // Compute imageUrl by fetching the SVG and applying color replacement.
  // Cached per side to avoid redundant fetches.
  const [imageUrl, setImageUrl] = useState<string>("");
  const svgCacheRef = useRef<Partial<Record<"front" | "back", string>>>({});

  useEffect(() => {
    let cancelled = false;
    const svgPath = mockupConfig.svgPaths[side] ?? mockupConfig.svgPaths.front;

    const load = async () => {
      if (!svgCacheRef.current[side]) {
        const res = await fetch(svgPath);
        svgCacheRef.current[side] = await res.text();
      }
      if (!cancelled) {
        setImageUrl(buildColoredDataUrl(svgCacheRef.current[side]!, shirtColorHex));
      }
    };
    load().catch(console.error);
    return () => { cancelled = true; };
  }, [side, shirtColorHex]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClipartSelect(svgUrl: string) {
    canvasRef.current?.addClipart(svgUrl);
  }

  function handleColorChange(name: string) {
    setShirtColorName(name);
    const firstSize = product.variants.find((v) => v.color === name)?.size ?? "";
    setSelectedSize(firstSize);
  }

  function handleActiveTextChange(isText: boolean, font: string, color: string) {
    setIsTextSelected(isText);
    if (isText) { setActiveFont(font); setActiveColor(color); }
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
        source: "local",
        variantId: selectedVariant.id,
        productName: product.name,
        productSlug: product.slug,
        colorName: shirtColorName,
        sizeName: selectedSize,
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
      <DesignerToolbar
        onClipartOpen={() => setIsClipartOpen(true)}
        onAddText={() => canvasRef.current?.addText()}
      />

      <div className="flex flex-1 flex-col items-center overflow-auto px-4 py-8 lg:px-8 lg:py-10">
        <DesignerCanvas
          ref={canvasRef}
          imageUrl={imageUrl}
          side={side}
          printArea={mockupConfig.printArea}
          onActiveTextChange={handleActiveTextChange}
        />

        {isTextSelected && (
          <div className="mt-3">
            <TextOptionsBar
              currentFont={activeFont}
              currentColor={activeColor}
              onFontChange={(font) => { setActiveFont(font); canvasRef.current?.setTextFont(font); }}
              onColorChange={(color) => { setActiveColor(color); canvasRef.current?.setTextColor(color); }}
            />
          </div>
        )}

        {mockupConfig.hasSides && (
          <div className="mt-3 flex rounded-lg border border-border-light bg-white p-1 shadow-card">
            <button
              onClick={() => setSide("front")}
              aria-pressed={side === "front"}
              className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
                side === "front" ? "bg-charcoal text-white" : "text-muted hover:text-charcoal"
              }`}
            >
              Elől
            </button>
            <button
              onClick={() => setSide("back")}
              aria-pressed={side === "back"}
              className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
                side === "back" ? "bg-charcoal text-white" : "text-muted hover:text-charcoal"
              }`}
            >
              Hátul
            </button>
          </div>
        )}
      </div>

      <aside className="hidden w-72 flex-shrink-0 flex-col border-l border-border-light bg-white p-6 lg:flex">
        <h2 className="text-lg font-semibold text-charcoal">{product.name}</h2>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-charcoal">Méret</p>
          <div className="flex flex-wrap gap-2">
            {sizesForColor.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                aria-pressed={size === selectedSize}
                className={`rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors ${
                  size === selectedSize
                    ? "border-charcoal bg-charcoal text-white"
                    : "border-border-medium text-charcoal hover:border-charcoal"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-charcoal">
            Szín: <span className="font-normal text-muted">{shirtColorName}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {availableColors.map(({ name, hex }) => (
              <button
                key={hex}
                onClick={() => handleColorChange(name)}
                aria-label={name}
                aria-pressed={shirtColorHex === hex}
                title={name}
                style={{ backgroundColor: hex }}
                className={`h-8 w-8 rounded-full border-2 transition-all ${
                  shirtColorHex === hex
                    ? "border-charcoal ring-2 ring-charcoal ring-offset-1"
                    : "border-border-light hover:border-charcoal"
                }`}
              />
            ))}
          </div>
        </div>

        {selectedVariant && (
          <p className="mt-5 text-xl font-semibold text-charcoal">
            {formatHuf(selectedVariant.price)}
          </p>
        )}

        {selectedVariant && !isInStock && (
          <p className="mt-2 text-sm text-error">Ez a méret jelenleg nem elérhető.</p>
        )}
        {addToCartError && <p className="mt-2 text-sm text-error">{addToCartError}</p>}

        <div className="flex-1" />

        <button
          onClick={handleAddToCart}
          disabled={!isInStock || !selectedVariant || isAddingToCart}
          className="mt-6 w-full rounded-sm bg-charcoal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAddingToCart ? "Mentés..." : "Kosárba"}
        </button>
      </aside>

      {isClipartOpen && (
        <ClipartPanel
          onSelect={handleClipartSelect}
          onClose={() => setIsClipartOpen(false)}
        />
      )}
    </div>
  );
}

// ── Malfini mode ──────────────────────────────────────────────────────────────

function MalfiniDesignerLayout({
  malfiniProduct,
  initialVariant,
  initialNomenclature,
  priceMap,
  availabilityMap,
}: MalfiniProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const categoryConfig = getCategoryConfig(malfiniProduct.categoryCode);
  // categoryConfig is guaranteed non-null — the designer page only routes here
  // for products whose categoryCode is in CATEGORY_CONFIG.
  const printArea = categoryConfig!.printArea;
  const hasSides = categoryConfig!.hasSides;

  const [selectedVariant, setSelectedVariant] = useState<MalfiniVariant>(initialVariant);
  const [selectedNomenclature, setSelectedNomenclature] = useState<MalfiniNomenclature | null>(
    initialNomenclature,
  );
  const [side, setSide] = useState<"front" | "back">("front");
  const [isClipartOpen, setIsClipartOpen] = useState(false);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [activeFont, setActiveFont] = useState<string>(DEFAULT_TEXT_FONT);
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_TEXT_COLOR);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addToCartError, setAddToCartError] = useState<string | null>(null);

  const canvasRef = useRef<DesignerCanvasRef>(null);

  // Compute imageUrl directly from variant image data — no async work needed.
  // Fall back to front image if back is requested but unavailable.
  const viewCode = side === "front" ? "a" : "b";
  const imageUrl =
    selectedVariant.images.find((i) => i.viewCode === viewCode)?.link ??
    selectedVariant.images.find((i) => i.viewCode === "a")?.link ??
    "";

  // Color entries — only variants with a front image are shown.
  const colorEntries: ColorEntry[] = malfiniProduct.variants
    .filter((v) => v.images.some((i) => i.viewCode === "a"))
    .map((v) => ({ name: v.name, hex: v.code, iconUrl: v.colorIconLink }));

  const sortedNomenclatures = sortNomenclatures(selectedVariant.nomenclatures);

  const selectedSku = selectedNomenclature?.productSizeCode ?? "";
  const price = priceMap[selectedSku] ?? 0;
  const stock = availabilityMap[selectedSku] ?? 0;
  const isInStock = stock > 0;

  function handleColorChange(_name: string, variantCode: string) {
    const newVariant = malfiniProduct.variants.find((v) => v.code === variantCode);
    if (!newVariant) return;
    setSelectedVariant(newVariant);
    setSelectedNomenclature(sortNomenclatures(newVariant.nomenclatures)[0] ?? null);
  }

  function handleActiveTextChange(isText: boolean, font: string, color: string) {
    setIsTextSelected(isText);
    if (isText) { setActiveFont(font); setActiveColor(color); }
  }

  async function handleAddToCart() {
    if (!selectedNomenclature || !isInStock || isAddingToCart) return;
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
        source: "malfini",
        productSizeCode: selectedNomenclature.productSizeCode,
        productCode: malfiniProduct.code,
        productName: malfiniProduct.name,
        colorName: selectedVariant.name,
        sizeName: selectedNomenclature.sizeName,
        price,
        imageUrl,
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
      <DesignerToolbar
        onClipartOpen={() => setIsClipartOpen(true)}
        onAddText={() => canvasRef.current?.addText()}
      />

      <div className="flex flex-1 flex-col items-center overflow-auto px-4 py-8 lg:px-8 lg:py-10">
        <DesignerCanvas
          ref={canvasRef}
          imageUrl={imageUrl}
          side={side}
          printArea={printArea}
          onActiveTextChange={handleActiveTextChange}
        />

        {isTextSelected && (
          <div className="mt-3">
            <TextOptionsBar
              currentFont={activeFont}
              currentColor={activeColor}
              onFontChange={(font) => { setActiveFont(font); canvasRef.current?.setTextFont(font); }}
              onColorChange={(color) => { setActiveColor(color); canvasRef.current?.setTextColor(color); }}
            />
          </div>
        )}

        {hasSides && (
          <div className="mt-3 flex rounded-lg border border-border-light bg-white p-1 shadow-card">
            <button
              onClick={() => setSide("front")}
              aria-pressed={side === "front"}
              className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
                side === "front" ? "bg-charcoal text-white" : "text-muted hover:text-charcoal"
              }`}
            >
              Elől
            </button>
            <button
              onClick={() => setSide("back")}
              aria-pressed={side === "back"}
              className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
                side === "back" ? "bg-charcoal text-white" : "text-muted hover:text-charcoal"
              }`}
            >
              Hátul
            </button>
          </div>
        )}
      </div>

      <aside className="hidden w-72 flex-shrink-0 flex-col border-l border-border-light bg-white p-6 lg:flex">
        <h2 className="text-lg font-semibold text-charcoal">{malfiniProduct.name}</h2>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-charcoal">Méret</p>
          <div className="flex flex-wrap gap-2">
            {sortedNomenclatures.map((nom) => {
              const nomInStock = (availabilityMap[nom.productSizeCode] ?? 0) > 0;
              const isSelected = nom.productSizeCode === selectedNomenclature?.productSizeCode;
              return (
                <button
                  key={nom.productSizeCode}
                  onClick={() => setSelectedNomenclature(nom)}
                  aria-pressed={isSelected}
                  disabled={!nomInStock}
                  className={`rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-charcoal bg-charcoal text-white"
                      : nomInStock
                        ? "border-border-medium text-charcoal hover:border-charcoal"
                        : "border-border-light text-muted line-through cursor-not-allowed"
                  }`}
                >
                  {nom.sizeName}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-charcoal">
            Szín: <span className="font-normal text-muted">{selectedVariant.name}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {colorEntries.map(({ name, hex, iconUrl }) => (
              <button
                key={hex}
                onClick={() => handleColorChange(name, hex)}
                aria-label={name}
                aria-pressed={selectedVariant.code === hex}
                title={name}
                className={`h-8 w-8 overflow-hidden rounded-full border-2 transition-all ${
                  selectedVariant.code === hex
                    ? "border-charcoal ring-2 ring-charcoal ring-offset-1"
                    : "border-border-light hover:border-charcoal"
                }`}
              >
                {iconUrl && (
                  <img src={iconUrl} alt={name} className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </div>

        {price > 0 && (
          <p className="mt-5 text-xl font-semibold text-charcoal">{formatHuf(price)}</p>
        )}

        {selectedNomenclature && !isInStock && (
          <p className="mt-2 text-sm text-error">Ez a méret jelenleg nem elérhető.</p>
        )}
        {addToCartError && <p className="mt-2 text-sm text-error">{addToCartError}</p>}

        <div className="flex-1" />

        <button
          onClick={handleAddToCart}
          disabled={!isInStock || !selectedNomenclature || isAddingToCart}
          className="mt-6 w-full rounded-sm bg-charcoal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAddingToCart ? "Mentés..." : "Kosárba"}
        </button>
      </aside>

      {isClipartOpen && (
        <ClipartPanel
          onSelect={(svgUrl) => canvasRef.current?.addClipart(svgUrl)}
          onClose={() => setIsClipartOpen(false)}
        />
      )}
    </div>
  );
}
