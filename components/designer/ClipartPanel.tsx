"use client";

import { useEffect, useState } from "react";
import type { Clipart } from "@/lib/services/clipart";

interface ClipartPanelProps {
  onSelect: (svgUrl: string) => void;
  onClose: () => void;
}

export default function ClipartPanel({ onSelect, onClose }: ClipartPanelProps) {
  const [items, setItems] = useState<Clipart[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch clipart from the API on mount
  useEffect(() => {
    fetch("/api/clipart")
      .then((res) => res.json())
      .then((data: Clipart[]) => {
        setItems(data);
        // Derive unique categories preserving the sort order from the API
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

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const visibleItems = activeCategory
    ? items.filter((item) => item.category === activeCategory)
    : items;

  return (
    // Overlay — clicking the backdrop closes the panel
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      {/* Panel — stop click propagation so clicking inside doesn't close */}
      <div
        className="flex h-[70vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-6 py-4">
          <h2 className="text-lg font-semibold text-charcoal">Motívumok</h2>
          <button
            onClick={onClose}
            aria-label="Bezárás"
            className="flex h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:bg-off-white hover:text-charcoal"
          >
            ✕
          </button>
        </div>

        {/* Category tabs */}
        {categories.length > 0 && (
          <div className="flex gap-2 border-b border-border-light px-6 py-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-charcoal text-white"
                    : "bg-off-white text-muted hover:bg-border-light hover:text-charcoal"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-sm text-muted">Betöltés…</p>
          ) : visibleItems.length === 0 ? (
            <p className="text-center text-sm text-muted">Nincs elérhető motívum.</p>
          ) : (
            <ul className="grid grid-cols-4 gap-4 sm:grid-cols-5 md:grid-cols-6">
              {visibleItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onSelect(item.svgUrl);
                      onClose();
                    }}
                    title={item.name}
                    aria-label={item.name}
                    className="group flex w-full flex-col items-center gap-2 rounded-lg border border-border-light p-3 transition-all hover:border-charcoal hover:shadow-card"
                  >
                    {/* Render SVG as an <img> — Supabase Storage serves it with correct MIME type */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.svgUrl}
                      alt={item.name}
                      className="h-12 w-12 object-contain"
                    />
                    <span className="text-xs text-muted group-hover:text-charcoal">
                      {item.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
