// Order form (megrendelő lap): the catalogue it offers, file storage for its uploads and
// the creation of its orders. These orders are requests — no price, no payment, no
// shipping choice — and are settled with the customer by the shop afterwards.

import { prisma } from "@/lib/db";
import { createSupabaseAdmin, BUCKET_ORDER_FILES } from "@/lib/supabase";
import { getProducts } from "@/lib/malfini/client";
import { malfiniSizeLabel, sortNomenclatures } from "@/lib/malfini/sizeOrder";
import { GENDER_LABELS } from "@/lib/malfini/genderLabels";
import { malfiniCategoryLabel } from "@/lib/malfini/categoryConfig";
import { getActiveProducts } from "@/lib/services/product";
import { getFeaturedMalfiniCodes } from "@/lib/services/featured";
import {
  ORDER_FORM_LIMITS,
  type OrderFormAttachmentInput,
  type OrderFormColor,
  type OrderFormProduct,
} from "@/lib/orderForm/types";
import type {
  ResolvedOrderFormLine,
  ValidOrderFormSubmission,
} from "@/lib/orderForm/validate";

/**
 * The products the order form offers: the featured Malfini garments (same list as the
 * designer picker) followed by every active local product. Also the authority the
 * submission is validated against.
 */
export async function getOrderFormCatalog(): Promise<OrderFormProduct[]> {
  const [malfiniCatalog, featuredCodes, localProducts] = await Promise.all([
    getProducts("hu"),
    getFeaturedMalfiniCodes(),
    getActiveProducts(),
  ]);

  const clothing = featuredCodes.flatMap((code): OrderFormProduct[] => {
    const product = malfiniCatalog.find((p) => p.code === code);
    if (!product) return [];
    // Same rule as the storefront: only colours with a front photo are sold.
    const colors = product.variants
      .filter((v) => v.images.some((i) => i.viewCode === "a"))
      .map((v) => ({
        name: v.name,
        sizes: sortNomenclatures(v.nomenclatures).map((n) => ({
          label: malfiniSizeLabel(n.sizeName),
          ref: n.productSizeCode,
        })),
      }))
      .filter((c) => c.sizes.length > 0);
    if (colors.length === 0) return [];
    const gender = GENDER_LABELS[product.genderCode ?? ""];
    return [
      {
        key: `malfini:${product.code}`,
        name: `${product.name} – ${malfiniCategoryLabel(product)}${gender ? `, ${gender}` : ""}`,
        group: product.categoryCode === "bags" ? "Táskák" : "Ruházat",
        colors,
      },
    ];
  });

  const local = localProducts.flatMap((product): OrderFormProduct[] => {
    // Group the variants by colour, keeping first-seen order.
    const colors: OrderFormColor[] = [];
    for (const variant of product.variants) {
      let color = colors.find((c) => c.name === variant.color);
      if (!color) {
        color = { name: variant.color, sizes: [] };
        colors.push(color);
      }
      color.sizes.push({ label: variant.size, ref: variant.id });
    }
    if (colors.length === 0) return [];
    return [
      {
        key: `local:${product.id}`,
        name: product.name,
        group: product.category ?? "Egyéb termékek",
        colors,
      },
    ];
  });

  return [...clothing, ...local];
}

// The order-files bucket is private: customer artwork is only reachable through
// short-lived signed URLs. The size cap is enforced by the bucket itself, because the
// browser uploads straight to storage and never through our server.
async function ensureOrderFilesBucket() {
  const supabase = createSupabaseAdmin();
  const { data: bucket } = await supabase.storage.getBucket(BUCKET_ORDER_FILES);
  if (!bucket) {
    const { error } = await supabase.storage.createBucket(BUCKET_ORDER_FILES, {
      public: false,
      fileSizeLimit: ORDER_FORM_LIMITS.maxFileBytes,
    });
    // Ignore a race where another request created it first.
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  return supabase;
}

/**
 * Issues a one-off signed upload URL for a new object "<yyyy-mm>/<uuid>.<ext>".
 * The browser uploads the file directly to storage with it.
 */
export async function createOrderFileUploadUrl(
  ext: string
): Promise<{ path: string; signedUrl: string }> {
  const supabase = await ensureOrderFilesBucket();
  const month = new Date().toISOString().slice(0, 7);
  const path = `${month}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(BUCKET_ORDER_FILES)
    .createSignedUploadUrl(path);
  if (error) throw error;
  return { path: data.path, signedUrl: data.signedUrl };
}

/**
 * Looks up the uploaded objects. Returns null if any of them does not exist — the
 * customer must not be told the order went through with a file missing.
 */
export async function getUploadedOrderFiles(
  attachments: OrderFormAttachmentInput[]
): Promise<
  | (OrderFormAttachmentInput & { sizeBytes: number; contentType: string | null })[]
  | null
> {
  if (attachments.length === 0) return [];
  const supabase = createSupabaseAdmin();
  const files = [];
  for (const attachment of attachments) {
    const { data, error } = await supabase.storage
      .from(BUCKET_ORDER_FILES)
      .info(attachment.path);
    if (error || !data) return null;
    files.push({
      ...attachment,
      sizeBytes: data.size ?? 0,
      contentType: data.contentType ?? null,
    });
  }
  return files;
}

/** A short-lived download link for an order attachment (admin). */
export async function createOrderFileDownloadUrl(
  storagePath: string,
  fileName: string
): Promise<string> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET_ORDER_FILES)
    .createSignedUrl(storagePath, 60, { download: fileName });
  if (error) throw error;
  return data.signedUrl;
}

export async function getOrderAttachment(orderId: string, attachmentId: string) {
  return prisma.orderAttachment.findFirst({
    where: { id: attachmentId, orderId },
  });
}

/** Creates an ORDER_FORM order with its lines and attachments, atomically. */
export async function createOrderFormOrder(
  submission: Omit<ValidOrderFormSubmission, "attachments"> & {
    attachments: (OrderFormAttachmentInput & {
      sizeBytes: number;
      contentType: string | null;
    })[];
  }
) {
  return prisma.order.create({
    data: {
      channel: "ORDER_FORM",
      status: "REQUESTED",
      customerName: submission.name,
      customerEmail: submission.email,
      customerPhone: submission.phone,
      customerNote: submission.note,
      gdprConsent: true,
      items: {
        create: submission.lines.map(
          (line: ResolvedOrderFormLine, position) => ({
            position,
            ...(line.source === "local"
              ? { variantId: line.variantId }
              : {
                  productSizeCode: line.productSizeCode,
                  productCode: line.productCode,
                }),
            productName: line.productName,
            colorName: line.colorName,
            sizeName: line.sizeName,
            quantity: line.quantity,
          })
        ),
      },
      attachments: {
        create: submission.attachments.map((a) => ({
          storagePath: a.path,
          fileName: a.fileName,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
        })),
      },
    },
    include: {
      items: { orderBy: { position: "asc" } },
      attachments: true,
    },
  });
}
