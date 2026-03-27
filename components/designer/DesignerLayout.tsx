"use client";

import { useState } from "react";
import DesignerCanvas from "./DesignerCanvas";
import ColorPicker from "./ColorPicker";

// Default shirt color — matches the SVG's native gray so no reload is needed on first paint
export const DEFAULT_SHIRT_COLOR = "#9ca3af";

export default function DesignerLayout() {
  const [shirtColor, setShirtColor] = useState(DEFAULT_SHIRT_COLOR);

  return (
    <div className="flex bg-off-white">
      {/* Left toolbar — color picker visible now, clipart + text added in 3.3–3.4 */}
      <aside className="hidden w-20 flex-shrink-0 bg-charcoal lg:flex lg:flex-col lg:items-center lg:py-6">
        <ColorPicker selectedColor={shirtColor} onChange={setShirtColor} />
      </aside>

      {/* Canvas area */}
      <div className="flex flex-1 items-start justify-center overflow-auto px-4 py-8 lg:items-center lg:px-8 lg:py-10">
        <DesignerCanvas shirtColor={shirtColor} />
      </div>

      {/* Right summary panel — wired up in step 3.5 */}
      <aside className="hidden w-64 flex-shrink-0 border-l border-border-light bg-white p-6 lg:block">
        <h2 className="mb-3 text-lg font-semibold text-charcoal">Tervezés</h2>
        <p className="text-sm text-muted">
          Adj hozzá szövegeket és motívumokat a tervezőből, majd add a terméket
          a kosárhoz.
        </p>
      </aside>
    </div>
  );
}
