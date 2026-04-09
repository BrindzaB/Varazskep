"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface PickerProduct {
  code: string;
  name: string;
  categoryName: string;
  imageUrl: string;
  genderCode: string | null;
}

interface ProductPickerPanelProps {
  products: PickerProduct[];
}

const GENDER_LABELS: Record<string, string> = {
  GENTS: "Férfi",
  LADIES: "Női",
  UNISEX: "Uniszex",
  KIDS: "Gyerek",
  "GENTS/KIDS": "Férfi/Gyerek",
  "UNISEX/KIDS": "Uniszex/Gyerek",
};

export default function ProductPickerPanel({ products }: ProductPickerPanelProps) {
  const router = useRouter();

  function handleClose() {
    router.back();
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-8 py-5">
          <h2 className="text-xl font-semibold text-charcoal">Válassz terméket</h2>
          <button
            onClick={handleClose}
            aria-label="Bezárás"
            className="flex h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:bg-off-white hover:text-charcoal"
          >
            ✕
          </button>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-8">
          {products.length === 0 ? (
            <p className="text-center text-sm text-muted">Nem sikerült betölteni a termékeket.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <li key={product.code}>
                  <button
                    onClick={() => router.push(`/designer?code=${product.code}`)}
                    className="group flex w-full flex-col items-center gap-3 rounded-lg border border-border-light p-4 transition-all hover:border-brand-violet hover:shadow-card"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-40 w-full object-contain"
                    />
                    <div className="flex w-full flex-col items-center gap-1">
                      <span className="text-center text-sm font-medium text-charcoal">
                        {product.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-center text-xs text-muted">
                          {product.categoryName}
                        </span>
                        {product.genderCode && (
                          <>
                            <span className="text-xs text-border-medium">·</span>
                            <span className="text-xs text-muted">
                              {GENDER_LABELS[product.genderCode] ?? product.genderCode}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
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
