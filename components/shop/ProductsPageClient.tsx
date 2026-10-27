"use client";

import { useState, useMemo, useEffect } from "react";
import MalfiniProductCard from "@/components/shop/MalfiniProductCard";
import ProductCard from "@/components/shop/ProductCard";
import CategoryIcon from "@/components/shop/CategoryIcon";
import type { MalfiniProduct } from "@/lib/malfini/types";
import type { ProductWithVariants } from "@/lib/services/product";
import { getMinPrice } from "@/lib/utils/format";
import {
  DEFAULT_CATEGORY_ICON,
  MALFINI_CATEGORY_ICONS,
  type CategoryIconKey,
} from "@/lib/shop/categoryIcons";
import {
  MALFINI_CATEGORY_LABELS,
  MALFINI_CATEGORY_ORDER,
  malfiniCategoryKey,
  malfiniCategoryLabel,
} from "@/lib/malfini/categoryConfig";
import {
  matchesSearch,
  sortProducts,
  type ProductSort,
} from "@/lib/shop/productList";

export type ClothingProduct = MalfiniProduct & { minPrice: number };

type GenderFilter = "Összes" | "Férfi" | "Női" | "Gyerek";

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

const ALL_KEY = "__all__";

// A category tab. Local tabs come from Product.category (admin-editable);
// Malfini tabs from malfiniCategoryKey(). `code` holds the value to filter by.
interface CategoryTab {
  key: string;
  label: string;
  kind: "all" | "malfini" | "local";
  code?: string;
  icon: CategoryIconKey;
}

const PAGE_SIZE = 30;

// Shared by the search box and the sort select so the two match side by side.
const FIELD_CLASS =
  "h-10 w-full rounded border border-border-light bg-white text-sm text-charcoal focus:border-brand-blue focus:outline-none";

interface Props {
  clothingProducts: ClothingProduct[];
  localProducts: ProductWithVariants[];
  // "malfini:<code>" | "local:<productId>", in display order (lib/services/popular.ts).
  popularKeys: string[];
  // Admin-assigned pictograms of the local categories, by category name.
  categoryIcons: Record<string, CategoryIconKey>;
}

type ListItem =
  | { type: "malfini"; product: ClothingProduct }
  | { type: "local"; product: ProductWithVariants };

function itemKey(item: ListItem): string {
  return item.type === "malfini"
    ? `malfini:${item.product.code}`
    : `local:${item.product.id}`;
}

function itemPrice(item: ListItem): number {
  return item.type === "malfini"
    ? item.product.minPrice
    : getMinPrice(item.product.variants);
}

// What the search box matches against: the name, plus the category so that "póló" also
// finds Malfini products named only by their model ("Basic", "Heavy").
function searchFields(item: ListItem): string[] {
  return item.type === "malfini"
    ? [item.product.name, malfiniCategoryLabel(item.product)]
    : [item.product.name, item.product.category ?? ""];
}

export default function ProductsPageClient({
  clothingProducts,
  localProducts,
  popularKeys,
  categoryIcons,
}: Props) {
  const [gender, setGender] = useState<GenderFilter>("Összes");
  const [categoryKey, setCategoryKey] = useState<string>(ALL_KEY);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProductSort>("name");
  const [page, setPage] = useState(0);

  // Build the tab list: "Összes" + Malfini categories (fixed order) + local
  // categories derived from Product.category (in DB order).
  const tabs = useMemo<CategoryTab[]>(() => {
    const list: CategoryTab[] = [
      { key: ALL_KEY, label: "Összes", kind: "all", icon: "all" },
    ];

    const clothingCats = new Set(clothingProducts.map(malfiniCategoryKey));
    for (const code of MALFINI_CATEGORY_ORDER) {
      if (clothingCats.has(code)) {
        list.push({
          key: `m:${code}`,
          label: MALFINI_CATEGORY_LABELS[code] ?? code,
          kind: "malfini",
          code,
          icon: MALFINI_CATEGORY_ICONS[code] ?? DEFAULT_CATEGORY_ICON,
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
      list.push({
        key: `l:${cat}`,
        label: cat,
        kind: "local",
        code: cat,
        icon: categoryIcons[cat] ?? DEFAULT_CATEGORY_ICON,
      });
    }

    return list;
  }, [clothingProducts, localProducts, categoryIcons]);

  const selectedTab = tabs.find((t) => t.key === categoryKey) ?? tabs[0];

  const allItems = useMemo<ListItem[]>(
    () => [
      ...clothingProducts.map((p) => ({ type: "malfini" as const, product: p })),
      ...localProducts.map((p) => ({ type: "local" as const, product: p })),
    ],
    [clothingProducts, localProducts],
  );

  const filtered = useMemo<ListItem[]>(() => {
    const items = allItems.filter((item) => {
      if (item.type === "malfini") {
        // Clothing — shown under "Összes" and Malfini category tabs.
        if (selectedTab.kind === "local") return false;
        if (
          selectedTab.kind === "malfini" &&
          malfiniCategoryKey(item.product) !== selectedTab.code
        )
          return false;
        if (gender !== "Összes") {
          const matches = GENDER_MATCH[item.product.genderCode ?? ""] ?? [];
          if (!matches.includes(gender)) return false;
        }
      } else {
        // Local — shown under "Összes" and local category tabs.
        if (selectedTab.kind === "malfini") return false;
        if (
          selectedTab.kind === "local" &&
          item.product.category !== selectedTab.code
        )
          return false;
      }
      return matchesSearch(searchFields(item), query);
    });

    return sortProducts(items, sort, (i) => i.product.name, itemPrice);
  }, [allItems, gender, selectedTab, query, sort]);

  // Popular products in the admin's order; a key whose product is no longer listed
  // (inactive, removed, out of the designer catalogue) is skipped.
  const popularItems = useMemo<ListItem[]>(() => {
    const byKey = new Map(allItems.map((item) => [itemKey(item), item]));
    return popularKeys.flatMap((key) => {
      const item = byKey.get(key);
      return item ? [item] : [];
    });
  }, [allItems, popularKeys]);

  // Reset gender when a local category is selected (gender only applies to clothing).
  useEffect(() => {
    if (selectedTab.kind === "local") setGender("Összes");
  }, [selectedTab]);

  // Reset to page 0 whenever filters, search or sort change.
  useEffect(() => {
    setPage(0);
  }, [gender, categoryKey, query, sort]);

  const showGenderFilter =
    selectedTab.kind !== "local" && clothingProducts.length > 0;

  // The popular box belongs to the unfiltered first page only — once the customer
  // narrows the list down, it would just repeat products they did not ask for.
  const showPopular =
    popularItems.length > 0 &&
    selectedTab.kind === "all" &&
    gender === "Összes" &&
    query.trim() === "" &&
    page === 0;

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {tabs.length > 2 && (
        <>
          {/* Desktop: underlined tabs with the icon above the label. Horizontally
              scrollable so they never widen the page. */}
          <div className="mb-6 hidden overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_theme(colors.border.light)] md:block">
            <div className="flex w-max">
              {tabs.map((tab) => {
                const active = categoryKey === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCategoryKey(tab.key)}
                    aria-pressed={active}
                    className={`flex shrink-0 flex-col items-center gap-1 whitespace-nowrap border-b-2 px-5 py-2.5 text-sm font-bold text-brand-violet transition-colors ${
                      active
                        ? "border-brand-violet"
                        : "border-transparent hover:border-brand-violet/40"
                    }`}
                  >
                    <CategoryIcon icon={tab.icon} className="h-6 w-6" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile: pill-shaped tiles that wrap onto new rows — round, so they do
              not read as more of the square gender filter buttons below. */}
          <div className="mb-6 flex flex-wrap gap-2 md:hidden">
            {tabs.map((tab) => {
              const active = categoryKey === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCategoryKey(tab.key)}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
                    active
                      ? "border-brand-violet bg-brand-violet text-white"
                      : "border-border-light bg-white text-brand-violet hover:border-brand-violet"
                  }`}
                >
                  <CategoryIcon icon={tab.icon} className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Gender filter + search + sort row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {showGenderFilter && (
          <div className="flex flex-wrap gap-2 rounded">
            {GENDER_FILTERS.map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`h-10 rounded border px-4 text-sm font-medium transition-colors ${
                  gender === g
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-border-light bg-white text-charcoal hover:border-brand-blue hover:text-brand-blue"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}
        <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Keresés terméknévre</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés terméknévre…"
              className={`${FIELD_CLASS} pl-9 pr-3`}
            />
          </label>
          {/* Native select chrome differs per browser — drawn by hand so it matches
              the search box in height, border and rounding. */}
          <label className="relative w-full sm:w-56">
            <span className="sr-only">Rendezés</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ProductSort)}
              className={`${FIELD_CLASS} cursor-pointer appearance-none pl-3 pr-9`}
            >
              <option value="name">Név szerint (A–Z)</option>
              <option value="price-asc">Ár szerint növekvő</option>
              <option value="price-desc">Ár szerint csökkenő</option>
            </select>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </label>
        </div>
      </div>

      {showPopular && (
        <section className="mb-8 rounded border-2 border-brand-blue p-3 sm:p-5">
          <h2 className="mb-4 text-lg font-bold uppercase text-brand-blue">
            Népszerű termékek
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {popularItems.map((item) => (
              <ProductListCard key={itemKey(item)} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Product grid */}
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted">
          {query.trim()
            ? `Nincs a(z) „${query.trim()}” keresésnek megfelelő termék.`
            : "Nincs termék a kiválasztott szűrőknek megfelelően."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {pageItems.map((item) => (
              <ProductListCard key={itemKey(item)} item={item} />
            ))}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="mt-10 flex flex-wrap justify-center gap-2">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`h-9 w-9 rounded border text-sm font-medium transition-colors ${
                    page === i
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-border-light text-charcoal hover:border-brand-blue hover:text-brand-blue"
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

function ProductListCard({ item }: { item: ListItem }) {
  return item.type === "malfini" ? (
    <MalfiniProductCard product={item.product} minPrice={item.product.minPrice} />
  ) : (
    <ProductCard product={item.product} />
  );
}
