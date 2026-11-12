// Shared look of the product cards on the Termékek page — Malfini garments and local
// products (mugs, pillows) must frame, round and hover identically.

// The card itself: rounded frame, lift + shadow + violet border on hover.
export const PRODUCT_CARD_CLASS =
  "group flex flex-col overflow-hidden rounded border border-border-light bg-white transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-card hover:border-brand-violet";

const PRODUCT_CARD_IMAGE_BASE =
  "h-full w-full transition-transform duration-300 group-hover:scale-105";

// Malfini garment photos (white background): inset from the frame.
export const PRODUCT_CARD_IMAGE_INSET_CLASS = `${PRODUCT_CARD_IMAGE_BASE} object-contain p-3`;

// Local product photos carry their own (grey) background, which looks wrong as an inset
// square — they fill the image box edge to edge instead.
export const PRODUCT_CARD_IMAGE_FULL_CLASS = `${PRODUCT_CARD_IMAGE_BASE} object-cover`;
