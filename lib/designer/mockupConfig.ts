// Canvas dimensions (must match DesignerCanvas.tsx constants)
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 600;
const CX = CANVAS_WIDTH / 2; // 250
const CY = CANVAS_HEIGHT / 2; // 300

export interface PrintArea {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

// Real-world size of the printable area in centimetres. Used to convert the
// on-canvas pixel design into cm for the coordinate overlay, the saved
// production coordinates, and the A4-based print-fee tier. Per template, because
// a mug's print area is physically much smaller than a t-shirt's.
export interface PrintSizeCm {
  width: number;
  height: number;
}

export interface MockupConfig {
  // Human-readable label shown in the admin designer-template dropdown.
  label: string;
  svgPaths: { front: string; back?: string };
  printArea: PrintArea;
  // Real print area size in cm (see PrintSizeCm). Adjust per product after
  // measuring the actual printable surface.
  printAreaCm: PrintSizeCm;
  // Whether the product has a "front" and "back" side that the user can toggle
  hasSides: boolean;
  // false for static PNG mockups — skips SVG fetch + CSS color replacement in LocalDesignerLayout
  colorReplaceable?: boolean;
  // Override canvas height (px) — use for landscape products like mugs (default: 600)
  canvasHeight?: number;
}

export const MOCKUP_CONFIG: Record<string, MockupConfig> = {
  tshirt: {
    label: "Póló",
    svgPaths: {
      front: "/tshirt_front.svg",
      back: "/tshirt_back.svg",
    },
    // Print area spans from just below the collar to near the hem
    printArea: { width: 185, height: 300, centerX: CX, centerY: CY },
    printAreaCm: { width: 38, height: 48 }, // full adult t-shirt print area
    hasSides: true,
  },
  mug: {
    label: "Bögre (általános)",
    svgPaths: {
      front: "/mug-mockup.svg",
    },
    // Mug body is centered at ~(228, 285) on the canvas after scaling.
    // The body rect in the SVG (x=50, w=170, y=30, h=220) maps to a 250×323px
    // area. Print area uses comfortable margins inside that body.
    printArea: { width: 150, height: 190, centerX: 228, centerY: 285 },
    printAreaCm: { width: 20, height: 8 }, // realistic mug wrap — adjust after measuring
    hasSides: false,
  },
  pillow: {
    label: "Párna",
    svgPaths: {
      front: "/pillow-mockup.png",
    },
    // Print area centered on the pillow face — tune after visual check in designer.
    printArea: { width: 260, height: 260, centerX: CX, centerY: 320 },
    printAreaCm: { width: 35, height: 35 }, // 40×40 cm pillow, print area a bit smaller
    hasSides: false,
    colorReplaceable: false,
  },
  basic_mug: {
    label: "Bögre (sima)",
    svgPaths: { front: "/mug-flat-template.svg" },
    // Flat wrap template: printable band centered in the SVG surface rectangle (y=50, h=210 → centerY=155).
    printArea: { width: 382, height: 170, centerX: 239, centerY: 155 },
    printAreaCm: { width: 20, height: 8 }, // realistic mug wrap — adjust after measuring
    hasSides: false,
    colorReplaceable: false,
    canvasHeight: 310,
  },
  mug_with_spoon: {
    label: "Bögre (kanalas)",
    svgPaths: { front: "/mug-flat-template.svg" },
    printArea: { width: 382, height: 170, centerX: 239, centerY: 155 },
    printAreaCm: { width: 20, height: 8 }, // realistic mug wrap — adjust after measuring
    hasSides: false,
    colorReplaceable: false,
    canvasHeight: 310,
  },
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
