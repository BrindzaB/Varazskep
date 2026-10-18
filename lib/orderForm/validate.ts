// Server-side validation of an order form submission. Pure — no DB or network — so it is
// unit-tested. Product names, colours and sizes are taken from the catalogue, never from
// the request: the client only says which catalogue entry it picked.

import { normalizeHungarianPhone } from "@/lib/utils/phone";
import {
  fileExtension,
  ORDER_FORM_FILE_TYPES,
  ORDER_FORM_LIMITS,
  type OrderFormAttachmentInput,
  type OrderFormProduct,
} from "./types";

export interface ResolvedOrderFormLine {
  source: "malfini" | "local";
  variantId?: string; // local
  productSizeCode?: string; // malfini
  productCode?: string; // malfini
  productName: string;
  colorName: string;
  sizeName: string;
  quantity: number;
}

export interface ValidOrderFormSubmission {
  name: string;
  email: string;
  phone: string; // normalized +36…
  note: string;
  lines: ResolvedOrderFormLine[];
  attachments: OrderFormAttachmentInput[];
}

export type ValidationResult =
  | { ok: true; value: ValidOrderFormSubmission }
  | { ok: false; error: string };

// Paths the upload-url route hands out: "<yyyy-mm>/<uuid>.<ext>". Anything else was not
// issued by us and is rejected, so a submission cannot attach arbitrary bucket objects.
const ATTACHMENT_PATH =
  /^\d{4}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.([a-z]+)$/;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOrderFormSubmission(
  body: unknown,
  catalog: OrderFormProduct[]
): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Hiányzó adatok." };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > ORDER_FORM_LIMITS.maxNameLength) {
    return { ok: false, error: "Add meg a neved." };
  }

  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    return { ok: false, error: "Érvénytelen e-mail cím." };
  }

  const phone = normalizeHungarianPhone(
    typeof b.phone === "string" ? b.phone : ""
  );
  if (!phone) {
    return { ok: false, error: "Érvénytelen telefonszám." };
  }

  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (!note) {
    return { ok: false, error: "Írd le a megrendelés részleteit." };
  }
  if (note.length > ORDER_FORM_LIMITS.maxNoteLength) {
    return {
      ok: false,
      error: `A megrendelés szövege legfeljebb ${ORDER_FORM_LIMITS.maxNoteLength} karakter lehet.`,
    };
  }

  if (b.gdprConsent !== true) {
    return { ok: false, error: "Az adatkezelési hozzájárulás kötelező." };
  }

  const rawLines = Array.isArray(b.lines) ? b.lines : null;
  if (!rawLines || rawLines.length > ORDER_FORM_LIMITS.maxLines) {
    return {
      ok: false,
      error: `Legfeljebb ${ORDER_FORM_LIMITS.maxLines} tétel adható meg.`,
    };
  }
  const lines: ResolvedOrderFormLine[] = [];
  for (const raw of rawLines) {
    const line = resolveLine(raw, catalog);
    if (!line) {
      return {
        ok: false,
        error: "Érvénytelen tétel. Ellenőrizd a terméket, a színt, a méretet és a darabszámot.",
      };
    }
    lines.push(line);
  }

  const rawAttachments = Array.isArray(b.attachments) ? b.attachments : null;
  if (
    !rawAttachments ||
    rawAttachments.length > ORDER_FORM_LIMITS.maxAttachments
  ) {
    return {
      ok: false,
      error: `Legfeljebb ${ORDER_FORM_LIMITS.maxAttachments} fájl csatolható.`,
    };
  }
  const attachments: OrderFormAttachmentInput[] = [];
  for (const raw of rawAttachments) {
    const attachment = parseAttachment(raw);
    if (!attachment) {
      return { ok: false, error: "Érvénytelen csatolt fájl." };
    }
    attachments.push(attachment);
  }
  if (new Set(attachments.map((a) => a.path)).size !== attachments.length) {
    return { ok: false, error: "Érvénytelen csatolt fájl." };
  }

  return { ok: true, value: { name, email, phone, note, lines, attachments } };
}

function resolveLine(
  raw: unknown,
  catalog: OrderFormProduct[]
): ResolvedOrderFormLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { productKey, ref, quantity } = raw as Record<string, unknown>;
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > ORDER_FORM_LIMITS.maxQuantity
  ) {
    return null;
  }

  const product = catalog.find((p) => p.key === productKey);
  if (!product) return null;
  for (const color of product.colors) {
    const size = color.sizes.find((s) => s.ref === ref);
    if (!size) continue;
    const base = {
      productName: product.name,
      colorName: color.name,
      sizeName: size.label,
      quantity,
    };
    if (product.key.startsWith("malfini:")) {
      return {
        ...base,
        source: "malfini",
        productSizeCode: size.ref,
        productCode: product.key.slice("malfini:".length),
      };
    }
    return { ...base, source: "local", variantId: size.ref };
  }
  return null;
}

function parseAttachment(raw: unknown): OrderFormAttachmentInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { path, fileName } = raw as Record<string, unknown>;
  if (typeof path !== "string" || typeof fileName !== "string") return null;
  const match = ATTACHMENT_PATH.exec(path);
  if (!match || !(match[1] in ORDER_FORM_FILE_TYPES)) return null;
  const name = fileName.trim();
  if (!name || name.length > 255) return null;
  if (fileExtension(name) !== match[1]) return null;
  return { path, fileName: name };
}
