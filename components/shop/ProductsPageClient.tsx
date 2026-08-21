"use client";

import { useState, useMemo, useEffect } from "react";
import MalfiniProductCard from "@/components/shop/MalfiniProductCard";
import ProductCard from "@/components/shop/ProductCard";
import type { MalfiniProduct } from "@/lib/malfini/types";
import type { ProductWithVariants } from "@/lib/services/product";

export type ClothingProduct = MalfiniProduct & { minPrice: number };

type GenderFilter = "Összes" | "Férfi" | "Női" | "Gyerek";
type SortOrder = "default" | "asc" | "desc";

const GENDER_FILTERS: GenderFilter[] = ["Összes", "Férfi", "Női", "Gyerek"];

// Which UI gender labels each Malfini genderCode matches.
const GENDER_MATCH: Record<string, GenderFilter[]> = {
  GENTS: ["Férfi"],
  LADIES: ["Női"],
  KIDS: ["Gyerek"],
  UNISEX: ["Férfi", "Női"],
  "GENTS/KIDS": ["Férfi", "Gyerek"],
  "UNISEX/KIDS": ["Férfi", "Női", "Gyerek"],
};

// Malfini category code → Hungarian label + fixed tab order.
const MALFINI_CATEGORY_LABEL: Record<string, string> = {
  "t-shirts": "Pólók",
  sweatshirts: "Pulóverek",
  "polo-shirts": "Galléros pólók",
};
const MALFINI_CATEGORY_ORDER = ["t-shirts", "sweatshirts", "polo-shirts"];

const ALL_KEY = "__all__";

// A category tab. Local tabs come from Product.category (admin-editable);
// Malfini tabs from the API categoryCode. `code` holds the value to filter by.
interface CategoryTab {
  key: string;
  label: string;
  kind: "all" | "malfini" | "local";
  code?: string;
}

const PAGE_SIZE = 30;

interface Props {
  clothingProducts: ClothingProduct[];
  localProducts: ProductWithVariants[];
}

type ListItem =
  | { type: "malfini"; product: ClothingProduct }
  | { type: "local"; product: ProductWithVariants };

export default function ProductsPageClient({
  clothingProducts,
  localProducts,
}: Props) {
  const [gender, setGender] = useState<GenderFilter>("Összes");
  const [categoryKey, setCategoryKey] = useState<string>(ALL_KEY);
  const [sort, setSort] = useState<SortOrder>("default");
  const [page, setPage] = useState(0);

  // Build the tab list: "Összes" + Malfini categories (fixed order) + local
  // categories derived from Product.category (in DB order).
  const tabs = useMemo<CategoryTab[]>(() => {
    const list: CategoryTab[] = [{ key: ALL_KEY, label: "Összes", kind: "all" }];

    const clothingCats = new Set(clothingProducts.map((p) => p.categoryCode));
    for (const code of MALFINI_CATEGORY_ORDER) {
      if (clothingCats.has(code)) {
        list.push({
          key: `m:${code}`,
          label: MALFINI_CATEGORY_LABEL[code] ?? code,
          kind: "malfini",
          code,
        });
      }
    }

    const localCats = Array.from(
      new Set(
        localProducts
          .map((p) => p.category)
          .filter((c): c is string => Boolean(c)),
      ),
    );
    for (const cat of localCats) {
      list.push({ key: `l:${cat}`, label: cat, kind: "local", code: cat });
    }

    return list;
  }, [clothingProducts, localProducts]);

  const selectedTab = tabs.find((t) => t.key === categoryKey) ?? tabs[0];

  const filtered = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];

    // Clothing (Malfini) — shown under "Összes" and Malfini category tabs.
    const showClothing =
      selectedTab.kind === "all" || selectedTab.kind === "malfini";
    if (showClothing) {
      for (const p of clothingProducts) {
        if (selectedTab.kind === "malfini" && p.categoryCode !== selectedTab.code)
          continue;
        if (gender !== "Összes") {
          const matches = GENDER_MATCH[p.genderCode ?? ""] ?? [];
          if (!matches.includes(gender)) continue;
        }
        items.push({ type: "malfini", product: p });
      }
    }

    // Local — shown under "Összes" and local category tabs.
    const showLocal = selectedTab.kind === "all" || selectedTab.kind === "local";
    if (showLocal) {
      for (const p of localProducts) {
        if (selectedTab.kind === "local" && p.category !== selectedTab.code)
          continue;
        items.push({ type: "local", product: p });
      }
    }

    // Price sort — local products have no comparable price; put them last.
    if (sort !== "default") {
      items.sort((a, b) => {
        const priceA = a.type === "malfini" ? a.product.minPrice : Infinity;
        const priceB = b.type === "malfini" ? b.product.minPrice : Infinity;
        return sort === "asc" ? priceA - priceB : priceB - priceA;
      });
    }

    return items;
  }, [clothingProducts, localProducts, gender, selectedTab, sort]);

  // Reset gender when a local category is selected (gender only applies to clothing).
  useEffect(() => {
    if (selectedTab.kind === "local") setGender("Összes");
  }, [selectedTab]);

  // Reset to page 0 whenever filters or sort change.
  useEffect(() => {
    setPage(0);
  }, [gender, categoryKey, sort]);

  const showGenderFilter =
    selectedTab.kind !== "local" && clothingProducts.length > 0;

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {/* Category tabs — horizontally scrollable on narrow screens so they never
          widen the page (which would let the whole page scroll sideways). */}
      {tabs.length > 2 && (
        <div className="mb-6 overflow-x-auto border-b border-border-light">
          <div className="flex w-max">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCategoryKey(tab.key)}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-5 py-2.5 text-sm font-medium transition-colors ${
                  categoryKey === tab.key
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-charcoal hover:text-brand-blue"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gender filter + sort row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {showGenderFilter && (
          <div className="flex flex-wrap gap-2 rounded">
            {GENDER_FILTERS.map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                  gender === g
                    ? "bg-brand-blue text-white"
                    : "border border-border-medium bg-white text-charcoal hover:border-brand-blue hover:text-brand-blue"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOrder)}
          className="rounded border border-border-medium bg-white px-3 py-2 text-sm text-charcoal focus:outline-none"
        >
          <option value="default">Rendezés</option>
          <option value="asc">Ár: alacsonyabbtól magasabbig</option>
          <option value="desc">Ár: magasabbtól alacsonyabbig</option>
        </select>
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted">
          Nincs termék a kiválasztott szűrőknek megfelelően.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {pageItems.map((item) =>
              item.type === "malfini" ? (
                <MalfiniProductCard
                  key={item.product.code}
                  product={item.product}
                  minPrice={item.product.minPrice}
                />
              ) : (
                <ProductCard key={item.product.id} product={item.product} />
              ),
            )}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="mt-10 flex flex-wrap justify-center gap-2">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`h-9 w-9 rounded-sm text-sm font-medium transition-colors ${
                    page === i
                      ? "bg-brand-blue text-white"
                      : "border border-border-light text-charcoal hover:border-brand-blue hover:text-brand-blue"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
