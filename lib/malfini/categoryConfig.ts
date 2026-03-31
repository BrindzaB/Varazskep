// Maps Malfini categoryCode values to designer configuration.
// Products whose categoryCode is NOT in this map will not show the designer button.
//
// IMPORTANT: The categoryCode keys must be populated after making a real API call:
//   GET /api/v4/product?language=hu
// Extract the unique categoryCode values from the response, then fill in the
// entries below following the business rule:
//   - Enabled: t-shirts, polo shirts, sweatshirts, hoodies, and other wearable tops
//   - Disabled: caps, bags, jackets, footwear, accessories
//
// Print area dimensions are in canvas pixels (canvas is 500×600, mockup scaled to 88%).
// Use the same values as the tshirt config in lib/designer/mockupConfig.ts as a
// starting point, then adjust per product type after visual testing.

import type { PrintArea } from "@/lib/designer/mockupConfig";

export interface CategoryConfig {
  printArea: PrintArea;
  hasSides: boolean; // true = front/back toggle shown in the designer
}

// TODO: Replace placeholder keys with real Malfini categoryCode values.
// Example structure shown below — remove or adjust once real codes are known.
export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  // "TSHIRTS": {
  //   printArea: { width: 185, height: 210, centerX: 250, centerY: 285 },
  //   hasSides: true,
  // },
  // "SWEATSHIRTS": {
  //   printArea: { width: 185, height: 210, centerX: 250, centerY: 285 },
  //   hasSides: true,
  // },
  // "POLO": {
  //   printArea: { width: 160, height: 180, centerX: 250, centerY: 285 },
  //   hasSides: true,
  // },
};

// Returns the designer config for a Malfini product category, or null if the
// category does not support the designer.
export function getCategoryConfig(categoryCode: string): CategoryConfig | null {
  return CATEGORY_CONFIG[categoryCode] ?? null;
}
