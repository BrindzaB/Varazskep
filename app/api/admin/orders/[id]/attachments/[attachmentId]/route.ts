import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";
import {
  createOrderFileDownloadUrl,
  getOrderAttachment,
} from "@/lib/services/orderForm";

// Downloads an order form attachment. The files live in a private bucket, so the admin
// is redirected to a signed URL that expires after a minute.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attachment = await getOrderAttachment(params.id, params.attachmentId);
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const url = await createOrderFileDownloadUrl(
      attachment.storagePath,
      attachment.fileName
    );
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[admin] attachment download failed:", err);
    return NextResponse.json(
      { error: "A fájl nem érhető el." },
      { status: 500 }
    );
  }
}
