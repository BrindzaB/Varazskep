import type { Metadata } from "next";
import DesignerCanvas from "@/components/designer/DesignerCanvas";

export const metadata: Metadata = {
  title: "Tervező – Varázskép",
  description: "Tervezd meg egyedi pólódat a Varázskép online tervezőjével.",
};

export default function DesignerPage() {
  return (
    <div className="flex bg-off-white">
      {/* Left toolbar — populated in steps 3.2–3.4 */}
      <aside className="hidden w-20 flex-shrink-0 bg-charcoal lg:flex lg:flex-col lg:items-center lg:py-6">
        {/* Tool buttons added in Phase 3.2–3.4 */}
      </aside>

      {/* Canvas area */}
      <div className="flex flex-1 items-start justify-center overflow-auto px-4 py-8 lg:items-center lg:px-8 lg:py-10">
        <DesignerCanvas />
      </div>

      {/* Right summary panel — populated in step 3.5 */}
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
