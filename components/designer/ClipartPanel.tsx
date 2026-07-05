"use client";

import { useEffect, useState } from "react";
import type { Clipart } from "@/lib/services/clipart";

interface ClipartPanelProps {
  onSelect: (svgUrl: string, darkSvgUrl: string | null) => void;
  onClose: () => void;
}

export default function ClipartPanel({ onSelect, onClose }: ClipartPanelProps) {
  const [items, setItems] = useState<Clipart[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          <button
            onClick={onClose}
            aria-label="Bezárás"
            className="flex h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:bg-off-white hover:text-charcoal"
          >
            ✕
          </button>
        </div>

        {/* Body: category nav + clipart grid.
            Mobile: stacked — categories in a horizontal, scrollable row on top.
            Desktop (lg+): side-by-side — categories as a left sidebar. */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Categories */}
          <div className="flex shrink-0 flex-row gap-2 overflow-x-auto border-b border-border-light p-3 lg:w-44 lg:flex-col lg:gap-1 lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-r">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
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
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <p className="text-center text-sm text-muted">Betöltés…</p>
            ) : visibleItems.length === 0 ? (
              <p className="text-center text-sm text-muted">Nincs elérhető motívum.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {visibleItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        onSelect(item.svgUrl, item.darkSvgUrl ?? null);
                        onClose();
                      }}
                      title={item.name}
                      aria-label={item.name}
                      className="group flex aspect-square w-full items-center justify-center rounded-lg border border-border-light p-3 transition-all hover:border-charcoal hover:shadow-card"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.svgUrl}
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
