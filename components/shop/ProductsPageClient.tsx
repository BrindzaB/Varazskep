"use client";

import { useState, useMemo, useEffect } from "react";
import MalfiniProductCard from "@/components/shop/MalfiniProductCard";
import ProductCard from "@/components/shop/ProductCard";
import type { MalfiniProduct } from "@/lib/malfini/types";
import type { ProductWithVariants } from "@/lib/services/product";

export type ClothingProduct = MalfiniProduct & { minPrice: number };

type GenderFilter = "Összes" | "Férfi" | "Női" | "Gyerek";
type CategoryFilter = "Összes" | "t-shirts" | "sweatshirts" | "polo-shirts" | "local";
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

const CATEGORY_LABEL: Record<string, string> = {
  "t-shirts": "Pólók",
  sweatshirts: "Pulóverek",
  "polo-shirts": "Galléros pólók",
  local: "Bögrék",
};

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
  const [category, setCategory] = useState<CategoryFilter>("Összes");
  const [sort, setSort] = useState<SortOrder>("default");
  const [page, setPage] = useState(0);

  // Derive category tabs from which categories actually have products.
  const availableCategories = useMemo<CategoryFilter[]>(() => {
    const cats: CategoryFilter[] = ["Összes"];
    const clothingCats = new Set(clothingProducts.map((p) => p.categoryCode));
    if (clothingCats.has("t-shirts")) cats.push("t-shirts");
    if (clothingCats.has("sweatshirts")) cats.push("sweatshirts");
    if (clothingCats.has("polo-shirts")) cats.push("polo-shirts");
    if (localProducts.length > 0) cats.push("local");
    return cats;
  }, [clothingProducts, localProducts]);

  const filtered = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];

    // Clothing products — apply gender + category filter.
    const showClothing =
      category === "Összes" ||
      category === "t-shirts" ||
      category === "sweatshirts" ||
      category === "polo-shirts";

    if (showClothing) {
      for (const p of clothingProducts) {
        if (category !== "Összes" && p.categoryCode !== category) continue;
        if (gender !== "Összes") {
          const matches = GENDER_MATCH[p.genderCode ?? ""] ?? [];
          if (!matches.includes(gender)) continue;
        }
        items.push({ type: "malfini", product: p });
      }
    }

    // Local products — always shown regardless of gender filter.
    if (category === "Összes" || category === "local") {
      for (const p of localProducts) {
        items.push({ type: "local", product: p });
      }
    }

    // Price sort — local products have no comparable price; put them last when sorting.
    if (sort !== "default") {
      items.sort((a, b) => {
        const priceA = a.type === "malfini" ? a.product.minPrice : Infinity;
        const priceB = b.type === "malfini" ? b.product.minPrice : Infinity;
        return sort === "asc" ? priceA - priceB : priceB - priceA;
      });
    }

    return items;
  }, [clothingProducts, localProducts, gender, category, sort]);

  // Reset to page 0 whenever filters or sort change.
  useEffect(() => {
    setPage(0);
  }, [gender, category, sort]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {/* Gender filter + sort row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {clothingProducts.length > 0 && (
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

      {/* Category tabs */}
      {availableCategories.length > 2 && (
        <div className="mb-8 border-b border-border-light">
          <div className="flex">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-medium transition-colors ${
                  category === cat
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-charcoal hover:text-brand-blue"
                }`}
              >
                {cat === "Összes" ? "Összes" : CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>
        </div>
      )}

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
