import { getProductDesignConfig } from "./categoryConfig";
import type { MalfiniProduct } from "./types";

/**
 * Whether a Malfini product is listed on the Termékek page: it has a designer
 * config and at least one variant has a front photo for the card.
 */
export function isStorefrontClothing(p: MalfiniProduct): boolean {
  return (
    getProductDesignConfig(p) !== null &&
    p.variants.some((v) => v.images.some((i) => i.viewCode === "a"))
  );
}
