import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export interface CanvasJson {
  front: unknown[];
  back: unknown[];
}

/**
 * Pre-creates a Design record when the customer clicks "Add to cart" in the designer.
 * The record holds the Fabric.js canvas state (user objects only, not the mockup layer).
 * expiresAt is set to 45 days from now — Supabase Storage lifecycle will clean up the
 * SVG export after that period (step 3.6). The DB record itself is retained with the order.
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
