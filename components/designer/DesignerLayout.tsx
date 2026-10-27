"use client";

import {
  type ChangeEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DesignerCanvas, {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type DesignerCanvasRef,
} from "./DesignerCanvas";
import type { PrintFees } from "@/lib/pricing/printFee";
import { type ColorEntry } from "./ColorPicker";
import ClipartPanel from "./ClipartPanel";
import TextOptionsBar, {
  DEFAULT_TEXT_FONT,
  DEFAULT_TEXT_COLOR,
} from "./TextOptionsBar";
import { COLOR_MAP } from "@/lib/utils/colors";
import { getMockupConfig } from "@/lib/designer/mockupConfig";
import { templateGeometry } from "@/lib/designer/templates";
import { buildColoredDataUrl } from "@/lib/designer/colorUtils";
import { getProductDesignConfig } from "@/lib/malfini/categoryConfig";
import { malfiniSizeLabel, sortNomenclatures } from "@/lib/malfini/sizeOrder";
import { useCartStore } from "@/lib/cart/cartStore";
import { formatHuf } from "@/lib/utils/format";
import type { ProductWithVariants } from "@/lib/services/product";
import type {
  MalfiniProduct,
  MalfiniVariant,
  MalfiniNomenclature,
} from "@/lib/malfini/types";

// ── Canvas scaling wrapper ────────────────────────────────────────────────────
// Shrinks the canvas to fit the available container width on narrow screens.
// Uses ResizeObserver so it reacts to layout changes without a window resize listener.
// On desktop (container ≥ CANVAS_WIDTH) scale === 1 — no visual change.
function ScaledCanvasWrapper({
  children,
  canvasHeight = CANVAS_HEIGHT,
}: {
  children: ReactNode;
  canvasHeight?: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(CANVAS_WIDTH);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(1, containerWidth / CANVAS_WIDTH);
  // margin: auto doesn't center an element wider than its container — compute the
  // translateX offset explicitly so the scaled canvas is always perfectly centered.
  const offsetX = (containerWidth - CANVAS_WIDTH * scale) / 2;

  return (
    <div
      ref={wrapperRef}
      className="w-full overflow-hidden"
      style={{ height: canvasHeight * scale }}
    >
      <div
        style={{
          transform: `translateX(${offsetX}px) scale(${scale})`,
          transformOrigin: "top left",
          width: CANVAS_WIDTH,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Shared toolbar UI ─────────────────────────────────────────────────────────

interface ToolbarProps {
  onClipartOpen: () => void;
  onAddText: () => void;
  onImageUploadClick: () => void;
  isUploading: boolean;
}

function DesignerToolbar({
  onClipartOpen,
  onAddText,
  onImageUploadClick,
  isUploading,
}: ToolbarProps) {
  return (
    <aside className="flex w-full flex-row justify-around bg-charcoal px-4 py-3 lg:w-20 lg:flex-shrink-0 lg:flex-col lg:items-center lg:justify-start lg:gap-6 lg:px-0 lg:py-6">
      <Link
        href="/designer"
        title="Termék váltása"
        aria-label="Termék váltása"
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

      <div className="hidden w-10 border-t border-white/20 lg:block" />

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

      <div className="hidden w-10 border-t border-white/20 lg:block" />

      <button
        onClick={onImageUploadClick}
        disabled={isUploading}
        title="Saját kép feltöltése"
        aria-label="Saját kép feltöltése"
        className="flex flex-col items-center gap-1 text-white/60 transition-colors hover:text-white disabled:opacity-50"
      >
        {isUploading ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 animate-spin"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        ) : (
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
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
        <span className="text-xs font-medium">Kép</span>
      </button>

      <div className="hidden w-10 border-t border-white/20 lg:block" />

      <button
        onClick={onAddText}
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
  );
}

// ── Shared designer behaviour ─────────────────────────────────────────────────
// Everything both product sources do the same way: image upload, design saving,
// clipart insertion and the controls around the canvas.

// Uploads a customer image and places it on the canvas.
function useImageUpload(canvasRef: RefObject<DesignerCanvasRef | null>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected if needed
    e.target.value = "";

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/designs/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Upload failed");
      }
      const { url } = (await res.json()) as { url: string };
      await canvasRef.current?.addImage(url);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "A feltöltés sikertelen."
      );
    } finally {
      setIsUploading(false);
    }
  }

  return { fileInputRef, isUploading, uploadError, handleFileChange };
}

// Saves the canvas (both sides + preview image) and returns the new design id.
async function saveDesign(
  canvasRef: RefObject<DesignerCanvasRef | null>
): Promise<string> {
  const canvasData = canvasRef.current?.getCanvasJson() ?? {
    front: [],
    back: [],
  };
  const previewDataUrl = canvasRef.current?.getPreviewDataUrl() ?? null;
  const res = await fetch("/api/designs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ canvasJson: canvasData, previewDataUrl }),
  });
  if (!res.ok) throw new Error("Design save failed");
  const { id } = (await res.json()) as { id: string };
  return id;
}

// Inserts a clipart in whichever variant the light/dark toggle currently shows, so a newly
// added motif matches the active mode. Falls back to the light variant when the clipart has
// no dark version.
function insertClipart(
  canvasRef: RefObject<DesignerCanvasRef | null>,
  showDark: boolean,
  svgUrl: string,
  darkSvgUrl: string | null
) {
  const displayUrl = showDark && darkSvgUrl ? darkSvgUrl : svgUrl;
  canvasRef.current?.addClipart(displayUrl, svgUrl, darkSvgUrl);
}

function DarkModeToggle({
  showDark,
  onChange,
}: {
  showDark: boolean;
  onChange: (dark: boolean) => void;
}) {
  return (
    <div className="mb-2 flex rounded-lg border border-border-light bg-white p-1">
      {[false, true].map((dark) => (
        <button
          key={String(dark)}
          onClick={() => onChange(dark)}
          aria-pressed={showDark === dark}
          className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
            showDark === dark
              ? "bg-charcoal text-white"
              : "text-muted hover:text-charcoal"
          }`}
        >
          {dark ? "Sötét alap" : "Világos alap"}
        </button>
      ))}
    </div>
  );
}

function SideToggle({
  side,
  onChange,
}: {
  side: "front" | "back";
  onChange: (side: "front" | "back") => void;
}) {
  return (
    <div className="mt-3 flex gap-2 rounded-lg bg-white p-1">
      {(["front", "back"] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-pressed={side === s}
          className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
            side === s
              ? "border border-brand-violet bg-brand-violet text-white"
              : "border border-border-medium text-muted hover:border-brand-violet hover:text-brand-violet"
          }`}
        >
          {s === "front" ? "Elől" : "Hátul"}
        </button>
      ))}
    </div>
  );
}

// Font and colour controls for the selected text object.
function ActiveTextOptions({
  canvasRef,
  font,
  color,
  onFontChange,
  onColorChange,
}: {
  canvasRef: RefObject<DesignerCanvasRef | null>;
  font: string;
  color: string;
  onFontChange: (font: string) => void;
  onColorChange: (color: string) => void;
}) {
  return (
    <div className="mt-3">
      <TextOptionsBar
        currentFont={font}
        currentColor={color}
        onFontChange={(f) => {
          onFontChange(f);
          canvasRef.current?.setTextFont(f);
        }}
        onColorChange={(c) => {
          onColorChange(c);
          canvasRef.current?.setTextColor(c);
        }}
      />
    </div>
  );
}

function PriceSummary({
  price,
  printFee,
}: {
  price: number;
  printFee: number;
}) {
  return (
    <div className="mt-5 space-y-1">
      <div className="flex justify-between text-sm text-muted">
        <span>Termék</span>
        <span>{formatHuf(price)}</span>
      </div>
      {printFee > 0 && (
        <div className="flex justify-between text-sm text-muted">
          <span>Nyomtatás</span>
          <span>{formatHuf(printFee)}</span>
        </div>
      )}
      <div className="flex justify-between border-t border-border-light pt-1 text-base font-semibold text-charcoal">
        <span>Összesen</span>
        <span>{formatHuf(price + printFee)}</span>
      </div>
    </div>
  );
}

function AddToCartButton({
  onClick,
  disabled,
  isSaving,
}: {
  onClick: () => void;
  disabled: boolean;
  isSaving: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-6 w-full rounded-sm bg-brand-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-violet disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSaving ? "Mentés..." : "Kosárba"}
    </button>
  );
}

const SAVE_ERROR = "Hiba történt a mentés során. Kérem, próbálja újra.";

// ── Props ─────────────────────────────────────────────────────────────────────

type LocalProps = {
  source: "local";
  product: ProductWithVariants;
  initialColor: string;
  initialSize: string;
  // Per-object print fees from the admin pricing settings. Shown to the customer;
  // the checkout recomputes the charge from the saved design.
  printFees: PrintFees;
};

type MalfiniProps = {
  source: "malfini";
  malfiniProduct: MalfiniProduct;
  initialVariant: MalfiniVariant;
  initialNomenclature: MalfiniNomenclature;
  priceMap: Record<string, number>;
  availabilityMap: Record<string, number>;
  printFees: PrintFees;
};

type DesignerLayoutProps = LocalProps | MalfiniProps;

export default function DesignerLayout(props: DesignerLayoutProps) {
  if (props.source === "malfini") return <MalfiniDesignerLayout {...props} />;
  return <LocalDesignerLayout {...props} />;
}

// Font/colour of the selected text object, mirrored from the canvas for the options bar.
function useActiveText() {
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [activeFont, setActiveFont] = useState<string>(DEFAULT_TEXT_FONT);
  const [activeColor, setActiveColor] = useState<string>(DEFAULT_TEXT_COLOR);

  function handleActiveTextChange(
    isText: boolean,
    font: string,
    color: string
  ) {
    setIsTextSelected(isText);
    if (isText) {
      setActiveFont(font);
      setActiveColor(color);
    }
  }

  return {
    isTextSelected,
    activeFont,
    setActiveFont,
    activeColor,
    setActiveColor,
    handleActiveTextChange,
  };
}

// ── Local mode ────────────────────────────────────────────────────────────────

const LOCAL_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function LocalDesignerLayout({
  product,
  initialColor,
  initialSize,
  printFees,
}: LocalProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  // The designer page redirects unless the product has a valid template, so
  // getMockupConfig is non-null here.
  const mockupConfig = getMockupConfig(product.mockupType ?? null)!;
  const geometry = templateGeometry(mockupConfig);

  const availableColors: ColorEntry[] = Array.from(
    new Set(product.variants.map((v) => v.color))
  ).map((name) => ({ name, hex: COLOR_MAP[name] ?? "#9ca3af" }));

  // Per-colour product photo shown beside the canvas — sourced from the DB
  // (variant.imageUrl), same as the storefront.
  const colorImages: Record<string, string> = {};
  for (const v of product.variants) {
    if (v.imageUrl && !colorImages[v.color]) colorImages[v.color] = v.imageUrl;
  }

  const [shirtColorName, setShirtColorName] = useState(initialColor);
  const shirtColorHex = COLOR_MAP[shirtColorName] ?? "#9ca3af";

  const [side, setSide] = useState<"front" | "back">("front");
  const [isClipartOpen, setIsClipartOpen] = useState(false);
  const text = useActiveText();
  const [hasClipartsWithDark, setHasClipartsWithDark] = useState(false);
  const [showDark, setShowDark] = useState(false);

  const sizesForColor = product.variants
    .filter((v) => v.color === shirtColorName)
    .map((v) => v.size)
    .sort((a, b) => LOCAL_SIZE_ORDER.indexOf(a) - LOCAL_SIZE_ORDER.indexOf(b));

  const [selectedSize, setSelectedSize] = useState(initialSize);

  const selectedVariant =
    product.variants.find(
      (v) => v.color === shirtColorName && v.size === selectedSize
    ) ?? null;
  const isInStock = selectedVariant ? selectedVariant.stock > 0 : false;

  const [printFee, setPrintFee] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addToCartError, setAddToCartError] = useState<string | null>(null);

  const canvasRef = useRef<DesignerCanvasRef>(null);
  const upload = useImageUpload(canvasRef);

  // Static PNG mockups (colorReplaceable === false) are used directly as imageUrl.
  // SVG mockups are fetched and color-replaced via buildColoredDataUrl.
  const isColorReplaceable = mockupConfig.colorReplaceable !== false;

  const [imageUrl, setImageUrl] = useState<string>(
    !isColorReplaceable
      ? (mockupConfig.svgPaths[side] ?? mockupConfig.svgPaths.front)
      : ""
  );
  const svgCacheRef = useRef<Partial<Record<"front" | "back", string>>>({});

  useEffect(() => {
    if (!isColorReplaceable) {
      setImageUrl(mockupConfig.svgPaths[side] ?? mockupConfig.svgPaths.front);
      return;
    }
    let cancelled = false;
    const svgPath = mockupConfig.svgPaths[side] ?? mockupConfig.svgPaths.front;

    const load = async () => {
      if (!svgCacheRef.current[side]) {
        const res = await fetch(svgPath);
        svgCacheRef.current[side] = await res.text();
      }
      if (!cancelled) {
        setImageUrl(
          buildColoredDataUrl(svgCacheRef.current[side]!, shirtColorHex)
        );
      }
    };
    load().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [side, shirtColorHex]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleColorChange(name: string) {
    setShirtColorName(name);
    const firstSize =
      product.variants.find((v) => v.color === name)?.size ?? "";
    setSelectedSize(firstSize);
  }

  async function handleAddToCart() {
    if (!selectedVariant || !isInStock || isAddingToCart) return;
    setIsAddingToCart(true);
    setAddToCartError(null);

    try {
      const designId = await saveDesign(canvasRef);
      addItem({
        source: "local",
        variantId: selectedVariant.id,
        productName: product.name,
        productSlug: product.slug,
        colorName: shirtColorName,
        sizeName: selectedSize,
        price: selectedVariant.price,
        printFee: printFee > 0 ? printFee : undefined,
        imageUrl: product.imageUrl ?? null,
        designId,
      });

      router.push("/cart");
    } catch {
      setAddToCartError(SAVE_ERROR);
    } finally {
      setIsAddingToCart(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-layout flex-col bg-white lg:flex-row">
      <DesignerToolbar
        onClipartOpen={() => setIsClipartOpen(true)}
        onAddText={() => canvasRef.current?.addText()}
        onImageUploadClick={() => upload.fileInputRef.current?.click()}
        isUploading={upload.isUploading}
      />
      <input
        ref={upload.fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={upload.handleFileChange}
      />

      <div className="flex flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-2 py-4">
        {hasClipartsWithDark && (
          <DarkModeToggle
            showDark={showDark}
            onChange={(dark) => {
              setShowDark(dark);
              canvasRef.current?.swapClipartVariants(dark);
            }}
          />
        )}

        <div className="flex w-full flex-col items-center">
          <ScaledCanvasWrapper canvasHeight={geometry.canvasHeight}>
            <DesignerCanvas
              ref={canvasRef}
              imageUrl={imageUrl}
              side={side}
              printArea={geometry.printArea}
              printAreaCm={geometry.printAreaCm}
              printFees={printFees}
              onActiveTextChange={text.handleActiveTextChange}
              onPrintFeeChange={setPrintFee}
              onDarkClipartChange={setHasClipartsWithDark}
              canvasHeight={geometry.canvasHeight}
              mockupSize={mockupConfig.mockupSize}
            />
          </ScaledCanvasWrapper>

          {colorImages[shirtColorName] && (
            <img
              src={colorImages[shirtColorName]}
              alt={shirtColorName}
              className="mt-4 max-w-full rounded object-contain"
              style={{ height: geometry.canvasHeight }}
            />
          )}
        </div>

        {text.isTextSelected && (
          <ActiveTextOptions
            canvasRef={canvasRef}
            font={text.activeFont}
            color={text.activeColor}
            onFontChange={text.setActiveFont}
            onColorChange={text.setActiveColor}
          />
        )}

        {upload.uploadError && (
          <p className="mt-2 text-sm text-error">{upload.uploadError}</p>
        )}

        {mockupConfig.hasSides && <SideToggle side={side} onChange={setSide} />}
      </div>

      <aside className="flex flex-col border-t border-border-light bg-white p-4 lg:w-72 lg:flex-shrink-0 lg:border-l lg:border-t-0 lg:p-6">
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
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-border-medium text-charcoal hover:border-brand-blue hover:text-brand-blue"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-charcoal">
            Szín:{" "}
            <span className="font-normal text-muted">{shirtColorName}</span>
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
          <PriceSummary price={selectedVariant.price} printFee={printFee} />
        )}

        {selectedVariant && !isInStock && (
          <p className="mt-2 text-sm text-error">
            Ez a méret jelenleg nem elérhető.
          </p>
        )}
        {addToCartError && (
          <p className="mt-2 text-sm text-error">{addToCartError}</p>
        )}

        <div className="hidden flex-1 lg:block" />

        <AddToCartButton
          onClick={handleAddToCart}
          disabled={!isInStock || !selectedVariant || isAddingToCart}
          isSaving={isAddingToCart}
        />
      </aside>

      {isClipartOpen && (
        <ClipartPanel
          onSelect={(svgUrl, darkSvgUrl) =>
            insertClipart(canvasRef, showDark, svgUrl, darkSvgUrl)
          }
          onClose={() => setIsClipartOpen(false)}
        />
      )}
    </div>
  );
}

// ── Malfini mode ─────────────────────────────────────────────────────────────

function MalfiniDesignerLayout({
  malfiniProduct,
  initialVariant,
  initialNomenclature,
  priceMap,
  availabilityMap,
  printFees,
}: MalfiniProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  // Non-null: the designer page only routes here for products that have a designer
  // config (getProductDesignConfig).
  const template = getProductDesignConfig(malfiniProduct)!;
  const geometry = templateGeometry(template);

  const [selectedVariant, setSelectedVariant] =
    useState<MalfiniVariant>(initialVariant);
  const [selectedNomenclature, setSelectedNomenclature] =
    useState<MalfiniNomenclature | null>(initialNomenclature);
  const [side, setSide] = useState<"front" | "back">("front");
  const [isClipartOpen, setIsClipartOpen] = useState(false);
  const text = useActiveText();
  const [hasClipartsWithDark, setHasClipartsWithDark] = useState(false);
  const [showDark, setShowDark] = useState(false);
  const [printFee, setPrintFee] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [addToCartError, setAddToCartError] = useState<string | null>(null);

  const canvasRef = useRef<DesignerCanvasRef>(null);
  const upload = useImageUpload(canvasRef);

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

  function handleColorChange(variantCode: string) {
    const newVariant = malfiniProduct.variants.find(
      (v) => v.code === variantCode
    );
    if (!newVariant) return;
    setSelectedVariant(newVariant);
    setSelectedNomenclature(
      sortNomenclatures(newVariant.nomenclatures)[0] ?? null
    );
  }

  async function handleAddToCart() {
    if (!selectedNomenclature || !isInStock || isAddingToCart) return;
    setIsAddingToCart(true);
    setAddToCartError(null);

    try {
      const designId = await saveDesign(canvasRef);
      addItem({
        source: "malfini",
        productSizeCode: selectedNomenclature.productSizeCode,
        productCode: malfiniProduct.code,
        productName: malfiniProduct.name,
        colorName: selectedVariant.name,
        sizeName: malfiniSizeLabel(selectedNomenclature.sizeName),
        price,
        printFee: printFee > 0 ? printFee : undefined,
        imageUrl,
        designId,
      });

      router.push("/cart");
    } catch {
      setAddToCartError(SAVE_ERROR);
    } finally {
      setIsAddingToCart(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-layout flex-col bg-white lg:flex-row">
      <DesignerToolbar
        onClipartOpen={() => setIsClipartOpen(true)}
        onAddText={() => canvasRef.current?.addText()}
        onImageUploadClick={() => upload.fileInputRef.current?.click()}
        isUploading={upload.isUploading}
      />
      <input
        ref={upload.fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={upload.handleFileChange}
      />

      <div className="flex flex-1 flex-col items-center overflow-auto px-2 py-4">
        {hasClipartsWithDark && (
          <DarkModeToggle
            showDark={showDark}
            onChange={(dark) => {
              setShowDark(dark);
              canvasRef.current?.swapClipartVariants(dark);
            }}
          />
        )}

        <ScaledCanvasWrapper canvasHeight={geometry.canvasHeight}>
          <DesignerCanvas
            ref={canvasRef}
            imageUrl={imageUrl}
            side={side}
            printArea={geometry.printArea}
            printAreaCm={geometry.printAreaCm}
            printFees={printFees}
            onActiveTextChange={text.handleActiveTextChange}
            onPrintFeeChange={setPrintFee}
            onDarkClipartChange={setHasClipartsWithDark}
            canvasHeight={geometry.canvasHeight}
            mockupSize={template.mockupSize}
          />
        </ScaledCanvasWrapper>

        {text.isTextSelected && (
          <ActiveTextOptions
            canvasRef={canvasRef}
            font={text.activeFont}
            color={text.activeColor}
            onFontChange={text.setActiveFont}
            onColorChange={text.setActiveColor}
          />
        )}

        {upload.uploadError && (
          <p className="mt-2 text-sm text-error">{upload.uploadError}</p>
        )}

        {template.hasSides && <SideToggle side={side} onChange={setSide} />}
      </div>

      <aside className="flex flex-col border-t border-border-light bg-white p-4 lg:w-72 lg:flex-shrink-0 lg:border-l lg:border-t-0 lg:p-6">
        <h2 className="text-lg font-semibold text-charcoal">
          {malfiniProduct.name}
        </h2>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-charcoal">Méret</p>
          <div className="flex flex-wrap gap-2">
            {sortedNomenclatures.map((nom) => {
              const nomInStock =
                (availabilityMap[nom.productSizeCode] ?? 0) > 0;
              const isSelected =
                nom.productSizeCode === selectedNomenclature?.productSizeCode;
              return (
                <button
                  key={nom.productSizeCode}
                  onClick={() => setSelectedNomenclature(nom)}
                  aria-pressed={isSelected}
                  disabled={!nomInStock}
                  className={`rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-brand-blue bg-brand-blue text-white"
                      : nomInStock
                        ? "border-border-medium text-charcoal hover:border-brand-blue hover:text-brand-blue"
                        : "cursor-not-allowed border-border-light text-muted line-through"
                  }`}
                >
                  {malfiniSizeLabel(nom.sizeName)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-charcoal">
            Szín:{" "}
            <span className="font-normal text-muted">
              {selectedVariant.name}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {colorEntries.map(({ name, hex, iconUrl }) => (
              <button
                key={hex}
                onClick={() => handleColorChange(hex)}
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
                  <img
                    src={iconUrl}
                    alt={name}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {price > 0 && <PriceSummary price={price} printFee={printFee} />}

        {selectedNomenclature && !isInStock && (
          <p className="mt-2 text-sm text-error">
            Ez a méret jelenleg nem elérhető.
          </p>
        )}
        {addToCartError && (
          <p className="mt-2 text-sm text-error">{addToCartError}</p>
        )}

        <div className="hidden flex-1 lg:block" />

        <AddToCartButton
          onClick={handleAddToCart}
          disabled={!isInStock || !selectedNomenclature || isAddingToCart}
          isSaving={isAddingToCart}
        />
      </aside>

      {isClipartOpen && (
        <ClipartPanel
          onSelect={(svgUrl, darkSvgUrl) =>
            insertClipart(canvasRef, showDark, svgUrl, darkSvgUrl)
          }
          onClose={() => setIsClipartOpen(false)}
        />
      )}
    </div>
  );
}
