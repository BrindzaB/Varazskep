import { prisma } from "@/lib/db";
import { createSupabaseAdmin, BUCKET_DESIGNS } from "@/lib/supabase";
import type { Prisma } from "@/lib/generated/prisma/client";

export interface CanvasJson {
  front: unknown[];
  back: unknown[];
}

// ── Canvas dimensions — must match DesignerCanvas.tsx ─────────────────────────
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 600;

// ── Fabric object shapes ──────────────────────────────────────────────────────

interface FabricBaseJson {
  type?: string;
  left?: number;
  top?: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
}

interface FabricITextJson extends FabricBaseJson {
  type: "i-text";
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  lineHeight?: number;
}

interface FabricImageJson extends FabricBaseJson {
  type: "image";
  src?: string;
  width?: number;
  height?: number;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fabricObjectToSvgElement(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const base = obj as FabricBaseJson;

  const left = base.left ?? 0;
  const top = base.top ?? 0;
  const angle = base.angle ?? 0;
  const scaleX = base.scaleX ?? 1;
  const scaleY = base.scaleY ?? 1;

  // All user objects use center origin. Build the transform by:
  //   1. translate to the center point
  //   2. rotate around that center
  //   3. scale (so the object is drawn at natural size relative to its center)
  const parts: string[] = [`translate(${left}, ${top})`];
  if (angle !== 0) parts.push(`rotate(${angle})`);
  if (scaleX !== 1 || scaleY !== 1) parts.push(`scale(${scaleX}, ${scaleY})`);
  const transform = parts.join(" ");

  if (base.type === "i-text") {
    const t = obj as FabricITextJson;
    const text = t.text ?? "";
    const fontSize = t.fontSize ?? 16;
    const fontFamily = t.fontFamily ?? "sans-serif";
    const fill = typeof t.fill === "string" ? t.fill : "#000000";
    const fontWeight = t.fontWeight ?? "normal";
    const fontStyle = t.fontStyle ?? "normal";
    const lineHeightFactor = t.lineHeight ?? 1.16;
    const lineHeightPx = fontSize * lineHeightFactor;

    const lines = text.split("\n");
    // Center the text block vertically around the translate point.
    // dy on the first tspan offsets above center; subsequent tspans step down.
    const startDy = -((lines.length - 1) * lineHeightPx) / 2;

    const tspans = lines
      .map((line, i) => {
        const dy = i === 0 ? startDy : lineHeightPx;
        return `<tspan x="0" dy="${dy.toFixed(2)}">${escapeXml(line || " ")}</tspan>`;
      })
      .join("");

    return (
      `<text transform="${transform}"` +
      ` font-family="${escapeXml(String(fontFamily))}"` +
      ` font-size="${fontSize}"` +
      ` fill="${escapeXml(fill)}"` +
      ` font-weight="${fontWeight}"` +
      ` font-style="${fontStyle}"` +
      ` text-anchor="middle"` +
      ` dominant-baseline="central">${tspans}</text>`
    );
  }

  if (base.type === "image") {
    const img = obj as FabricImageJson;
    const src = img.src ?? "";
    const w = img.width ?? 100;
    const h = img.height ?? 100;
    // Draw with center at (0, 0) within the transformed coordinate space.
    return (
      `<image transform="${transform}" href="${escapeXml(src)}"` +
      ` x="${(-w / 2).toFixed(2)}" y="${(-h / 2).toFixed(2)}"` +
      ` width="${w}" height="${h}"/>`
    );
  }

  return null;
}

/**
 * Converts an array of serialized Fabric objects to an SVG string.
 * Pure function — no side effects, suitable for unit testing.
 */
export function buildSvgFromObjects(
  objects: unknown[],
  width: number,
  height: number,
): string {
  const elements = objects
    .map(fabricObjectToSvgElement)
    .filter((el): el is string => el !== null)
    .join("\n  ");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <rect width="${width}" height="${height}" fill="white"/>`,
    elements ? `  ${elements}` : "",
    `</svg>`,
  ]
    .join("\n")
    .trim();
}

/**
 * Builds the full design SVG from a CanvasJson record.
 * - If only the front has objects: returns a single 500×600 SVG.
 * - If both sides have objects: returns a combined SVG with front and back
 *   panels side by side, labelled "Elől" / "Hátul".
 */
export function buildDesignSvg(canvasJson: CanvasJson): string {
  const frontObjects = Array.isArray(canvasJson.front) ? canvasJson.front : [];
  const backObjects = Array.isArray(canvasJson.back) ? canvasJson.back : [];
  const hasBack = backObjects.length > 0;

  if (!hasBack) {
    return buildSvgFromObjects(frontObjects, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  const GAP = 16;
  const LABEL_HEIGHT = 28;
  const totalWidth = CANVAS_WIDTH * 2 + GAP;
  const totalHeight = CANVAS_HEIGHT + LABEL_HEIGHT;

  const frontElements = frontObjects
    .map(fabricObjectToSvgElement)
    .filter((el): el is string => el !== null)
    .join("\n    ");

  const backElements = backObjects
    .map(fabricObjectToSvgElement)
    .filter((el): el is string => el !== null)
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
  <rect width="${totalWidth}" height="${totalHeight}" fill="#f9fafb"/>
  <!-- Front panel -->
  <g>
    <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="white" stroke="#e5e7eb" stroke-width="1"/>
    ${frontElements}
    <text x="${CANVAS_WIDTH / 2}" y="${CANVAS_HEIGHT + LABEL_HEIGHT - 8}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#6b7280">Elől</text>
  </g>
  <!-- Back panel -->
  <g transform="translate(${CANVAS_WIDTH + GAP}, 0)">
    <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="white" stroke="#e5e7eb" stroke-width="1"/>
    ${backElements}
    <text x="${CANVAS_WIDTH / 2}" y="${CANVAS_HEIGHT + LABEL_HEIGHT - 8}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#6b7280">Hátul</text>
  </g>
</svg>`;
}

// ── Database operations ───────────────────────────────────────────────────────

/**
 * Pre-creates a Design record when the customer clicks "Add to cart" in the designer.
 * The SVG export happens later, triggered by the Stripe webhook (see exportDesignSvg).
 */
export async function createDesign(canvasJson: CanvasJson) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

  return prisma.design.create({
    data: {
      canvasJson: canvasJson as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
    select: { id: true },
  });
}

/**
 * Renders the design to SVG and uploads it to Supabase Storage (designs bucket).
 * Called from the Stripe webhook after order creation. Updates Design.svgUrl on success.
 * Errors are thrown — callers should catch and log without failing the webhook.
 */
export async function exportDesignSvg(designId: string): Promise<void> {
  const design = await prisma.design.findUnique({ where: { id: designId } });
  if (!design) throw new Error(`Design not found: ${designId}`);

  const canvasJson = design.canvasJson as unknown as CanvasJson;
  const svgContent = buildDesignSvg(canvasJson);

  const supabase = createSupabaseAdmin();
  const fileName = `${designId}.svg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_DESIGNS)
    .upload(fileName, Buffer.from(svgContent, "utf-8"), {
      contentType: "image/svg+xml",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Supabase upload failed for ${fileName}: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_DESIGNS)
    .getPublicUrl(fileName);

  await prisma.design.update({
    where: { id: designId },
    data: { svgUrl: urlData.publicUrl },
  });
}
