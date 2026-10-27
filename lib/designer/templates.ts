// Print templates: where a design may go on a product mockup, and how big that is in reality.
//
// One template shape serves both product sources — local products pick theirs by
// Product.mockupType (lib/designer/mockupConfig.ts), Malfini products by storefront
// category (lib/malfini/categoryConfig.ts). A template is described in the mockup image's
// own pixels plus real centimetres, never in designer-canvas pixels: the canvas size and
// the way the mockup is fitted onto it are layout details, applied here in one place by
// templateGeometry(). The designer (client) and the print-fee check (server) both read the
// canvas geometry from that function, so they cannot drift apart.
//
// Pure module (no React, no DB) — safe on the server, the client and in tests.

// Designer canvas size in CSS pixels. Landscape templates (mugs) override the height.
export const CANVAS_WIDTH = 500;
export const CANVAS_HEIGHT = 600;

// The mockup is scaled to fill this share of the canvas in its tighter dimension, centred.
export const MOCKUP_SCALE_FACTOR = 0.95;

export interface ImageSize {
  width: number;
  height: number;
}

// Print area on the designer canvas, in canvas pixels. Derived — see templateGeometry().
export interface PrintArea {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

// Real-world size of the printable area in centimetres. Converts the on-canvas design to
// cm for the production coordinates, the print-fee tier and the A3 size cap.
export interface PrintSizeCm {
  width: number;
  height: number;
}

export interface PrintTemplate {
  // Natural pixel size of the mockup image (the Malfini photo or the local SVG/PNG).
  mockupSize: ImageSize;
  // Real-world scale of the mockup: mockup pixels per centimetre of the actual product,
  // measured on the photo against the product's real size (garments: Malfini size chart,
  // size M). One number keeps designs undistorted — a square logo stays square in cm.
  // { x, y } only for templates whose scale has not been measured yet (see the mugs).
  mockupPxPerCm: number | { x: number; y: number };
  // Printable area: its real size, and where its centre sits on the mockup (mockup px).
  printAreaCm: PrintSizeCm;
  printCenterPx: { x: number; y: number };
  // Whether the designer offers a front/back toggle.
  hasSides: boolean;
  // Canvas height override for landscape mockups (mugs). Defaults to CANVAS_HEIGHT.
  canvasHeight?: number;
}

export interface TemplateGeometry {
  printArea: PrintArea;
  printAreaCm: PrintSizeCm;
  canvasHeight: number;
}

/**
 * How a mockup image is fitted onto the canvas: uniformly scaled to MOCKUP_SCALE_FACTOR of
 * the tighter dimension and centred. DesignerCanvas lays the mockup out with this.
 */
export function mockupPlacement(
  image: ImageSize,
  canvas: ImageSize
): { scale: number; left: number; top: number } {
  const scale = Math.min(
    (canvas.width * MOCKUP_SCALE_FACTOR) / image.width,
    (canvas.height * MOCKUP_SCALE_FACTOR) / image.height
  );
  return {
    scale,
    left: (canvas.width - image.width * scale) / 2,
    top: (canvas.height - image.height * scale) / 2,
  };
}

/** The canvas-pixel print area of a template, as the designer and the checkout use it. */
export function templateGeometry(template: PrintTemplate): TemplateGeometry {
  const canvasHeight = template.canvasHeight ?? CANVAS_HEIGHT;
  const { scale, left, top } = mockupPlacement(template.mockupSize, {
    width: CANVAS_WIDTH,
    height: canvasHeight,
  });
  const pxPerCm =
    typeof template.mockupPxPerCm === "number"
      ? { x: template.mockupPxPerCm, y: template.mockupPxPerCm }
      : template.mockupPxPerCm;

  return {
    printArea: {
      width: template.printAreaCm.width * pxPerCm.x * scale,
      height: template.printAreaCm.height * pxPerCm.y * scale,
      centerX: left + template.printCenterPx.x * scale,
      centerY: top + template.printCenterPx.y * scale,
    },
    printAreaCm: template.printAreaCm,
    canvasHeight,
  };
}
