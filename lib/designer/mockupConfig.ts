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
  // false for static PNG mockups — skips SVG fetch + CSS color replacement in LocalDesignerLayout
  colorReplaceable?: boolean;
  // Per-color product photo paths shown as a preview below the canvas (mugs, etc.)
  colorImages?: Record<string, string>;
}

export const MOCKUP_CONFIG: Record<string, MockupConfig> = {
  tshirt: {
    svgPaths: {
      front: "/tshirt_front.svg",
      back: "/tshirt_back.svg",
    },
    // Print area spans from just below the collar to near the hem
    printArea: { width: 185, height: 300, centerX: CX, centerY: CY },
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
  pillow: {
    svgPaths: {
      front: "/pillow-mockup.png",
    },
    // Print area centered on the pillow face — tune after visual check in designer.
    printArea: { width: 260, height: 260, centerX: CX, centerY: 320 },
    hasSides: false,
    colorReplaceable: false,
  },
  basic_mug: {
    svgPaths: { front: "/mug-flat-template.svg" },
    // Flat wrap template: printable band centered in the SVG surface rectangle.
    printArea: { width: 382, height: 170, centerX: 239, centerY: 350 },
    hasSides: false,
    colorReplaceable: false,
    colorImages: {
      Fehér: "/mugs/basic_mug/Feh%C3%A9r.jpg",
      Fekete: "/mugs/basic_mug/Fekete.jpg",
      Sötétkék: "/mugs/basic_mug/S%C3%B6t%C3%A9tk%C3%A9k.jpg",
      Piros: "/mugs/basic_mug/Piros.jpg",
      Bordó: "/mugs/basic_mug/Bord%C3%B3.jpg",
      Középkék: "/mugs/basic_mug/K%C3%B6z%C3%A9pk%C3%A9k.jpg",
      Lila: "/mugs/basic_mug/Lila.jpg",
      Menta: "/mugs/basic_mug/Menta.jpg",
      Napsárga: "/mugs/basic_mug/Naps%C3%A1rga.jpg",
      Narancs: "/mugs/basic_mug/Narancs.jpg",
      Rózsaszín: "/mugs/basic_mug/R%C3%B3zsasz%C3%ADn.jpg",
      Sárga: "/mugs/basic_mug/S%C3%A1rga.jpg",
      Sötétzöld: "/mugs/basic_mug/S%C3%B6t%C3%A9tz%C3%B6ld.jpg",
      Türkiz: "/mugs/basic_mug/T%C3%BCrkiz.jpg",
      "Világos zöld": "/mugs/basic_mug/Vil%C3%A1gos%20z%C3%B6ld.jpg",
      Világoskék: "/mugs/basic_mug/Vil%C3%A1gosk%C3%A9k.jpg",
    },
  },
  mug_with_spoon: {
    svgPaths: { front: "/mug-flat-template.svg" },
    printArea: { width: 382, height: 170, centerX: 239, centerY: 350 },
    hasSides: false,
    colorReplaceable: false,
    colorImages: {
      Barna: "/mugs/mug_with_spoon/Kanalas_Barna.jpg",
      Kék: "/mugs/mug_with_spoon/Kanalas_K%C3%A9k.jpg",
      Narancs: "/mugs/mug_with_spoon/Kanalas_Narancs.jpg",
      Piros: "/mugs/mug_with_spoon/Kanalas_Piros.jpg",
      Rózsaszín: "/mugs/mug_with_spoon/Kanalas_R%C3%B3zsasz%C3%ADn.jpg",
      Sárga: "/mugs/mug_with_spoon/Kanalas_S%C3%A1rga.jpg",
      Zöld: "/mugs/mug_with_spoon/Kanalas_Z%C3%B6ld.jpg",
      Fekete: "/mugs/mug_with_spoon/Kanalas_fekete.jpg",
    },
  },
};

const DEFAULT_MOCKUP_CONFIG = MOCKUP_CONFIG.tshirt;

export function getMockupConfig(mockupType: string | null): MockupConfig {
  if (mockupType && mockupType in MOCKUP_CONFIG) {
    return MOCKUP_CONFIG[mockupType];
  }
  return DEFAULT_MOCKUP_CONFIG;
}
