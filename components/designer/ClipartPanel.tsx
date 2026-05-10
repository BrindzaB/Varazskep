"use client";

import { useEffect, useState } from "react";
import type { Clipart } from "@/lib/services/clipart";
import { isColorDark } from "@/lib/utils/colors";

interface ClipartPanelProps {
  onSelect: (svgUrl: string) => void;
  onClose: () => void;
  productColorHex?: string;
}

export default function ClipartPanel({ onSelect, onClose, productColorHex }: ClipartPanelProps) {
  const [items, setItems] = useState<Clipart[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDark, setShowDark] = useState(
    productColorHex ? isColorDark(productColorHex) : false
  );

  // Sync showDark when the product color changes externally
  useEffect(() => {
    if (productColorHex) setShowDark(isColorDark(productColorHex));
  }, [productColorHex]);

  // Fetch clipart from the API on mount
  useEffect(() => {
    fetch("/api/clipart")
      .then((res) => res.json())
      .then((data: Clipart[]) => {
        setItems(data);
        const seen = new Set<string>();
        const cats: string[] = [];
        for (const item of data) {
          if (!seen.has(item.category)) {
            seen.add(item.category);
            cats.push(item.category);
          }
        }
        setCategories(cats);
        setActiveCategory(cats[0] ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Close on Escape key + lock body scroll while open
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const visibleItems = activeCategory
    ? items.filter((item) => item.category === activeCategory)
    : items;

  // Show toggle only when the current category has at least one dark variant
  const categoryHasDarkVariants = visibleItems.some((item) => item.darkSvgUrl);

  function resolveUrl(item: Clipart): string {
    return showDark && item.darkSvgUrl ? item.darkSvgUrl : item.svgUrl;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-light px-6 py-4">
          <h2 className="text-lg font-semibold text-charcoal">Motívumok</h2>
          <div className="flex items-center gap-3">
            {categoryHasDarkVariants && (
              <button
                onClick={() => setShowDark((d) => !d)}
                title={showDark ? "Váltás világos alapra" : "Váltás sötét alapra"}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  showDark
                    ? "border-charcoal bg-charcoal text-white"
                    : "border-border-medium text-muted hover:border-charcoal hover:text-charcoal"
                }`}
              >
                {showDark ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                    Sötét alap
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                    Világos alap
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Bezárás"
              className="flex h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:bg-off-white hover:text-charcoal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body: category sidebar + clipart grid */}
        <div className="flex min-h-0 flex-1">
          {/* Category sidebar */}
          <div className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border-light p-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-charcoal text-white"
                    : "text-muted hover:bg-off-white hover:text-charcoal"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Clipart grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <p className="text-center text-sm text-muted">Betöltés…</p>
            ) : visibleItems.length === 0 ? (
              <p className="text-center text-sm text-muted">Nincs elérhető motívum.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-3">
                {visibleItems.map((item) => {
                  const previewUrl = resolveUrl(item);
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          onSelect(previewUrl);
                          onClose();
                        }}
                        title={item.name}
                        aria-label={item.name}
                        className={`group flex aspect-square w-full items-center justify-center rounded-lg border p-3 transition-all hover:border-charcoal hover:shadow-card ${
                          showDark ? "border-border-light bg-charcoal/5" : "border-border-light"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
