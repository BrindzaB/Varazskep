// Shared look of the product cards on the Termékek page — Malfini garments and local
// products (mugs, pillows) must frame, round and hover identically.

// The card itself: rounded frame, lift + shadow + violet border on hover.
export const PRODUCT_CARD_CLASS =
  "group flex flex-col overflow-hidden rounded border border-border-light bg-white transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-card hover:border-brand-violet";

// The product photo inside the 1:1 image box: inset from the frame, zooms on hover.
export const PRODUCT_CARD_IMAGE_CLASS =
  "h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105";
