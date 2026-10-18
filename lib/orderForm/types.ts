// Shapes shared by the order form (megrendelő lap) page, its client component and its
// API routes. The form is a request: no prices, no payment — the shop prices and settles
// each order with the customer afterwards.

/** One orderable size of a colour. `ref` is the Malfini SKU or the local Variant id. */
export interface OrderFormSize {
  label: string;
  ref: string;
}

export interface OrderFormColor {
  name: string;
  sizes: OrderFormSize[];
}

export interface OrderFormProduct {
  key: string; // "malfini:<code>" | "local:<productId>"
  name: string; // display name, also stored on the order line
  group: string; // dropdown group, e.g. "Ruházat"
  colors: OrderFormColor[];
}

export interface OrderFormLineInput {
  productKey: string;
  ref: string;
  quantity: number;
}

export interface OrderFormAttachmentInput {
  path: string; // object path returned by the upload-url route
  fileName: string; // original name, for display
}

export interface OrderFormSubmission {
  name: string;
  email: string;
  phone: string;
  note: string;
  lines: OrderFormLineInput[];
  attachments: OrderFormAttachmentInput[];
  gdprConsent: boolean;
  website: string; // honeypot — real visitors never see or fill it
}

// Limits — enforced on the client for feedback and on the server as the authority.
export const ORDER_FORM_LIMITS = {
  maxLines: 30,
  maxQuantity: 10000,
  maxNoteLength: 5000,
  maxNameLength: 200,
  maxAttachments: 10,
  maxFileBytes: 20 * 1024 * 1024,
} as const;

// Accepted upload extensions → content type. Vector formats are included because company
// logos usually arrive as PDF/SVG/AI/EPS. Browsers report AI/EPS types inconsistently, so
// the extension is what gets checked.
export const ORDER_FORM_FILE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  svg: "image/svg+xml",
  ai: "application/postscript",
  eps: "application/postscript",
};

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}
