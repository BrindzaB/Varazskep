// Designer templates for local products (mugs, pillows, …), picked by Product.mockupType.
// The admin assigns a template in the product form; a product without one is sellable but
// not designable. Malfini products use lib/malfini/categoryConfig.ts instead.
// The template shape and the canvas geometry live in lib/designer/templates.ts.

import type { PrintTemplate } from "./templates";

export interface MockupConfig extends PrintTemplate {
  // Human-readable label shown in the admin designer-template dropdown.
  label: string;
  svgPaths: { front: string; back?: string };
  // false for static mockups — skips the SVG fetch + CSS colour replacement in the designer
  colorReplaceable?: boolean;
}

// The flat mug-wrap template, shared by every mug: /mug-flat-template.svg is 500×310 with
// the printable band centred in its surface rectangle.
const MUG_WRAP: Omit<MockupConfig, "label"> = {
  svgPaths: { front: "/mug-flat-template.svg" },
  mockupSize: { width: 500, height: 310 },
  // NOT MEASURED YET: the band is drawn wider than a real 20×8 cm wrap is long, so the two
  // axes scale differently. Kept as it was until the mug is measured — the template test
  // lists it as the one allowed exception.
  mockupPxPerCm: { x: 20.106, y: 22.369 },
  printAreaCm: { width: 20, height: 8 },
  printCenterPx: { x: 238.4, y: 155 },
  hasSides: false,
  colorReplaceable: false,
  canvasHeight: 310,
};

export const MOCKUP_CONFIG: Record<string, MockupConfig> = {
  pillow: {
    label: "Párna",
    svgPaths: { front: "/pillow-mockup.png" },
    mockupSize: { width: 377, height: 336 },
    mockupPxPerCm: 5.896,
    printAreaCm: { width: 35, height: 35 }, // 40×40 cm pillow, print area a bit smaller
    printCenterPx: { x: 188.5, y: 183.9 },
    hasSides: false,
    colorReplaceable: false,
  },
  basic_mug: { label: "Bögre (sima)", ...MUG_WRAP },
  mug_with_spoon: { label: "Bögre (kanalas)", ...MUG_WRAP },
};

// Returns the designer template for a mockupType, or null if none exists.
// null means the product is not designable — callers must gate on this rather
// than silently falling back to another template.
export function getMockupConfig(mockupType: string | null): MockupConfig | null {
  if (mockupType && mockupType in MOCKUP_CONFIG) {
    return MOCKUP_CONFIG[mockupType];
  }
  return null;
}

// Single source of truth for the admin designer-template dropdown + list labels.
// When a developer adds a new template to MOCKUP_CONFIG, it appears here
// automatically, and the admin can then select it to make a product designable.
export function getMockupTemplates(): { key: string; label: string }[] {
  return Object.entries(MOCKUP_CONFIG).map(([key, cfg]) => ({
    key,
    label: cfg.label,
  }));
}

// Label for a mockupType key, or null if it has no template (not designable).
export function getMockupLabel(mockupType: string | null): string | null {
  if (mockupType && mockupType in MOCKUP_CONFIG) {
    return MOCKUP_CONFIG[mockupType].label;
  }
  return null;
}
