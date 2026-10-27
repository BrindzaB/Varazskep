import { describe, it, expect } from "vitest";
import {
  CANVAS_WIDTH,
  mockupPlacement,
  templateGeometry,
  type PrintArea,
  type PrintSizeCm,
  type PrintTemplate,
} from "@/lib/designer/templates";
import { MOCKUP_CONFIG } from "@/lib/designer/mockupConfig";
import { CATEGORY_CONFIG } from "@/lib/malfini/categoryConfig";

const TEMPLATES: Record<string, PrintTemplate> = {
  ...Object.fromEntries(
    Object.entries(MOCKUP_CONFIG).map(([k, v]) => [`local:${k}`, v])
  ),
  ...Object.fromEntries(
    Object.entries(CATEGORY_CONFIG).map(([k, v]) => [`malfini:${k}`, v])
  ),
};

// Canvas geometry as it was hard-coded before the templates moved to mockup coordinates.
// Designs saved before that change are re-priced at checkout with the current geometry, so
// these pin down that no saved design can grow in centimetres (and so jump a print tier or
// fail the A3 check) — and that unchanged templates still sit where they were.
const PREVIOUS: Record<string, { printArea: PrintArea; printAreaCm: PrintSizeCm }> = {
  "local:pillow": {
    printArea: { width: 260, height: 260, centerX: 250, centerY: 320 },
    printAreaCm: { width: 35, height: 35 },
  },
  "local:basic_mug": {
    printArea: { width: 382, height: 170, centerX: 239, centerY: 155 },
    printAreaCm: { width: 20, height: 8 },
  },
  "local:mug_with_spoon": {
    printArea: { width: 382, height: 170, centerX: 239, centerY: 155 },
    printAreaCm: { width: 20, height: 8 },
  },
  "malfini:t-shirts": {
    printArea: { width: 220, height: 300, centerX: 250, centerY: 300 },
    printAreaCm: { width: 38, height: 48 },
  },
  "malfini:sweatshirts": {
    printArea: { width: 220, height: 300, centerX: 252, centerY: 300 },
    printAreaCm: { width: 38, height: 48 },
  },
  "malfini:polo-shirts": {
    printArea: { width: 200, height: 300, centerX: 250, centerY: 310 },
    printAreaCm: { width: 38, height: 48 },
  },
  "malfini:gym-bags": {
    printArea: { width: 168, height: 222, centerX: 241, centerY: 401 },
    printAreaCm: { width: 25, height: 33 },
  },
  "malfini:tote-bags": {
    printArea: { width: 178, height: 208, centerX: 249, centerY: 399 },
    printAreaCm: { width: 30, height: 35 },
  },
};

// Measured templates get their placement unchanged; the garments were re-scaled on purpose.
const PLACEMENT_UNCHANGED = [
  "local:pillow",
  "local:basic_mug",
  "local:mug_with_spoon",
  "malfini:gym-bags",
  "malfini:tote-bags",
];

// The mug wrap has not been measured yet, so its two axes still scale differently.
const ANISOTROPIC_ALLOWED = ["local:basic_mug", "local:mug_with_spoon"];

const cmPerPx = (g: { printArea: PrintArea; printAreaCm: PrintSizeCm }) => ({
  x: g.printAreaCm.width / g.printArea.width,
  y: g.printAreaCm.height / g.printArea.height,
});

describe("mockupPlacement", () => {
  it("fits the mockup into 95% of the tighter canvas side, centred", () => {
    // A 400×453 Malfini photo on the 500×600 canvas: width is the tighter side.
    expect(mockupPlacement({ width: 400, height: 453 }, { width: 500, height: 600 }))
      .toEqual({ scale: 1.1875, left: 12.5, top: 31.03125 });
  });
});

describe("print templates", () => {
  it("covers every template with a previous-geometry baseline", () => {
    expect(Object.keys(PREVIOUS).sort()).toEqual(Object.keys(TEMPLATES).sort());
  });

  for (const [key, template] of Object.entries(TEMPLATES)) {
    describe(key, () => {
      const geometry = templateGeometry(template);
      const { printArea } = geometry;

      it("keeps designs undistorted (one scale for both axes)", () => {
        if (ANISOTROPIC_ALLOWED.includes(key)) return;
        expect(typeof template.mockupPxPerCm).toBe("number");
      });

      it("lies on the mockup and on the canvas", () => {
        const { scale, left, top } = mockupPlacement(template.mockupSize, {
          width: CANVAS_WIDTH,
          height: geometry.canvasHeight,
        });
        const mockup = {
          left,
          top,
          right: left + template.mockupSize.width * scale,
          bottom: top + template.mockupSize.height * scale,
        };
        expect(printArea.centerX - printArea.width / 2).toBeGreaterThanOrEqual(mockup.left);
        expect(printArea.centerX + printArea.width / 2).toBeLessThanOrEqual(mockup.right);
        expect(printArea.centerY - printArea.height / 2).toBeGreaterThanOrEqual(mockup.top);
        expect(printArea.centerY + printArea.height / 2).toBeLessThanOrEqual(mockup.bottom);
      });

      it("never makes a saved design larger in centimetres", () => {
        const before = cmPerPx(PREVIOUS[key]);
        const after = cmPerPx(geometry);
        expect(after.x).toBeLessThanOrEqual(before.x);
        expect(after.y).toBeLessThanOrEqual(before.y);
      });

      it("keeps the print area where it was on the canvas", () => {
        const before = PREVIOUS[key].printArea;
        // Half a pixel for unchanged templates; garments get 1.5 px, as their cm sizes were
        // rounded when the scale was corrected (the area itself was not moved).
        const tolerance = PLACEMENT_UNCHANGED.includes(key) ? 0.5 : 1.5;
        expect(Math.abs(printArea.centerX - before.centerX)).toBeLessThan(tolerance);
        expect(Math.abs(printArea.centerY - before.centerY)).toBeLessThan(tolerance);
        expect(Math.abs(printArea.width - before.width)).toBeLessThan(tolerance);
        expect(Math.abs(printArea.height - before.height)).toBeLessThan(tolerance);
      });
    });
  }
});
