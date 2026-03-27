"use client";

import { useRef, useState } from "react";
import DesignerCanvas, { type DesignerCanvasRef } from "./DesignerCanvas";
import ColorPicker from "./ColorPicker";
import ClipartPanel from "./ClipartPanel";

export const DEFAULT_SHIRT_COLOR = "#9ca3af";

export default function DesignerLayout() {
  const [shirtColor, setShirtColor] = useState(DEFAULT_SHIRT_COLOR);
  const [side, setSide] = useState<"front" | "back">("front");
  const [isClipartOpen, setIsClipartOpen] = useState(false);
  const canvasRef = useRef<DesignerCanvasRef>(null);

  function handleClipartSelect(svgUrl: string) {
    canvasRef.current?.addClipart(svgUrl);
  }

  return (
    <div className="flex bg-off-white">
      {/* Left toolbar */}
      <aside className="hidden w-20 flex-shrink-0 flex-col items-center gap-6 bg-charcoal py-6 lg:flex">
        <ColorPicker selectedColor={shirtColor} onChange={setShirtColor} />

        <div className="w-10 border-t border-white/20" />

        {/* Clipart button */}
        <button
          onClick={() => setIsClipartOpen(true)}
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
      </aside>

      {/* Canvas area */}
      <div className="flex flex-1 flex-col items-center overflow-auto px-4 py-8 lg:px-8 lg:py-10">
        <DesignerCanvas ref={canvasRef} shirtColor={shirtColor} side={side} />

        {/* Front / back toggle — sits directly below the canvas */}
        <div className="mt-4 flex rounded-lg border border-border-light bg-white p-1 shadow-card">
          <button
            onClick={() => setSide("front")}
            aria-pressed={side === "front"}
            className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
              side === "front"
                ? "bg-charcoal text-white"
                : "text-muted hover:text-charcoal"
            }`}
          >
            Elől
          </button>
          <button
            onClick={() => setSide("back")}
            aria-pressed={side === "back"}
            className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
              side === "back"
                ? "bg-charcoal text-white"
                : "text-muted hover:text-charcoal"
            }`}
          >
            Hátul
          </button>
        </div>
      </div>

      {/* Right summary panel — wired up in step 3.5 */}
      <aside className="hidden w-64 flex-shrink-0 border-l border-border-light bg-white p-6 lg:block">
        <h2 className="mb-3 text-lg font-semibold text-charcoal">Tervezés</h2>
        <p className="text-sm text-muted">
          Adj hozzá szövegeket és motívumokat a tervezőből, majd add a terméket
          a kosárhoz.
        </p>
      </aside>

      {/* Clipart modal */}
      {isClipartOpen && (
        <ClipartPanel
          onSelect={handleClipartSelect}
          onClose={() => setIsClipartOpen(false)}
        />
      )}
    </div>
  );
}
