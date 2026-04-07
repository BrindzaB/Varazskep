import { redirect } from "next/navigation";
import type { Metadata } from "next";
import DesignerLayout from "@/components/designer/DesignerLayout";
import ProductPickerPanel from "@/components/designer/ProductPickerPanel";
import { getProductBySlug } from "@/lib/services/product";
import {
  getProducts,
  getProduct,
  getRecommendedPrices,
  getAvailabilities,
  buildPriceMap,
  buildAvailabilityMap,
} from "@/lib/malfini/client";
import { convertEurToHuf } from "@/lib/malfini/pricing";

export const metadata: Metadata = {
  title: "Tervező – Varázskép",
  description: "Tervezd meg egyedi termékedet a Varázskép online tervezőjével.",
};

interface Props {
  searchParams: {
    // Malfini mode
    code?: string;
    colorCode?: string;
    sizeCode?: string;
    // Local mode
    slug?: string;
    color?: string;
    size?: string;
  };
}

// Products shown in the picker modal when the designer is opened with no URL params.
const DESIGNER_PRODUCT_CODES = ["129", "134", "138", "P41", "840", "P21", "P22"];

export default async function DesignerPage({ searchParams }: Props) {
  // ── Empty state: no URL params — show product picker ──────────────────────
  if (!searchParams.code && !searchParams.slug) {
    const allProducts = await getProducts("hu");
    const settled = DESIGNER_PRODUCT_CODES.map(
      (code) => allProducts.find((p) => p.code === code) ?? null
    );

    const pickerProducts = settled
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .flatMap((p) => {
        const variant = p.variants.find((v) => v.images.some((i) => i.viewCode === "a"));
        const imageUrl = variant?.images.find((i) => i.viewCode === "a")?.link;
        if (!imageUrl) return [];
        return [{ code: p.code, name: p.name, categoryName: p.categoryName, imageUrl, genderCode: p.genderCode ?? null }];
      });

    // Load the first available product as a blurred background designer.
    const bgCode = pickerProducts[0]?.code;
    const bgProduct = bgCode ? (settled.find((p) => p?.code === bgCode) ?? null) : null;
    const bgVariant = bgProduct?.variants.find((v) => v.images.some((i) => i.viewCode === "a")) ?? null;
    const bgNomenclature = bgVariant?.nomenclatures[0] ?? null;

    const [bgPrices, bgAvailabilities] = bgCode
      ? await Promise.all([getRecommendedPrices([bgCode]), getAvailabilities([bgCode])])
      : [[], []];

    const bgPriceMap = buildPriceMap(bgPrices, convertEurToHuf);
    const bgAvailabilityMap = buildAvailabilityMap(bgAvailabilities);

    return (
      <div className="relative h-[calc(100vh-4rem)] overflow-hidden">
        {/* Blurred designer background */}
        {bgProduct && bgVariant && bgNomenclature && (
          <div className="pointer-events-none absolute inset-0 select-none blur-sm" aria-hidden="true">
            <DesignerLayout
              source="malfini"
              malfiniProduct={bgProduct}
              initialVariant={bgVariant}
              initialNomenclature={bgNomenclature}
              priceMap={bgPriceMap}
              availabilityMap={bgAvailabilityMap}
            />
          </div>
        )}
        {/* Product picker overlay */}
        <ProductPickerPanel products={pickerProducts} />
      </div>
    );
  }

  // ── Malfini mode: ?code=M150&colorCode=01&sizeCode=M ──────────────────────
  if (searchParams.code) {
    const product = await getProduct(searchParams.code, "hu");
    if (!product) redirect("/products");

    // Resolve variant: match by colorCode, fall back to first with a front image
    const variant =
      product.variants.find((v) => v.code === searchParams.colorCode) ??
      product.variants.find((v) => v.images.some((i) => i.viewCode === "a")) ??
      product.variants[0];

    if (!variant) redirect("/products");

    // Resolve nomenclature: match by sizeCode, fall back to first
    const nomenclature =
      variant.nomenclatures.find((n) => n.sizeCode === searchParams.sizeCode) ??
      variant.nomenclatures[0];

    if (!nomenclature) redirect("/products");

    const [prices, availabilities] = await Promise.all([
      getRecommendedPrices([product.code]),
      getAvailabilities([product.code]),
    ]);
    const priceMap = buildPriceMap(prices, convertEurToHuf);
    const availabilityMap = buildAvailabilityMap(availabilities);

    return (
      <DesignerLayout
        source="malfini"
        malfiniProduct={product}
        initialVariant={variant}
        initialNomenclature={nomenclature}
        priceMap={priceMap}
        availabilityMap={availabilityMap}
      />
    );
  }

  // ── Local mode: ?slug=egyedi-bogre&color=Fehér&size=330ml ─────────────────
  const slug = searchParams.slug ?? "egyedi-polo";

  let product = await getProductBySlug(slug);
  if (!product || !product.mockupType) {
    product = await getProductBySlug("egyedi-polo");
  }

  if (!product || !product.mockupType) {
    redirect("/products");
  }

  const availableColors = Array.from(new Set(product.variants.map((v) => v.color)));
  const initialColor = availableColors.includes(searchParams.color ?? "")
    ? searchParams.color!
    : (availableColors[0] ?? "");

  const sizesForColor = product.variants
    .filter((v) => v.color === initialColor)
    .map((v) => v.size);
  const initialSize = sizesForColor.includes(searchParams.size ?? "")
    ? searchParams.size!
    : (sizesForColor[0] ?? "");

  return (
    <DesignerLayout
      source="local"
      product={product}
      initialColor={initialColor}
      initialSize={initialSize}
    />
  );
}
