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

export interface MockupConfig {
  svgPaths: { front: string; back?: string };
  printArea: PrintArea;
  // Whether the product has a "front" and "back" side that the user can toggle
  hasSides: boolean;
}

export const MOCKUP_CONFIG: Record<string, MockupConfig> = {
  tshirt: {
    svgPaths: {
      front: "/tshirt_front.svg",
      back: "/tshirt_back.svg",
    },
    // Upper-chest print area — matches the hardcoded values from step 3.1
    printArea: { width: 185, height: 210, centerX: CX, centerY: CY - 15 },
    hasSides: true,
  },
  mug: {
    svgPaths: {
      front: "/mug-mockup.svg",
    },
    // Mug body is centered at ~(228, 285) on the canvas after scaling.
    // The body rect in the SVG (x=50, w=170, y=30, h=220) maps to a 250×323px
    // area. Print area uses comfortable margins inside that body.
    printArea: { width: 150, height: 190, centerX: 228, centerY: 285 },
    hasSides: false,
  },
};

const DEFAULT_MOCKUP_CONFIG = MOCKUP_CONFIG.tshirt;

export function getMockupConfig(mockupType: string | null): MockupConfig {
  if (mockupType && mockupType in MOCKUP_CONFIG) {
    return MOCKUP_CONFIG[mockupType];
  }
  return DEFAULT_MOCKUP_CONFIG;
}
