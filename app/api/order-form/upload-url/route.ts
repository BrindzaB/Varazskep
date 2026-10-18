import { NextRequest, NextResponse } from "next/server";
import { createOrderFileUploadUrl } from "@/lib/services/orderForm";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import {
  fileExtension,
  ORDER_FORM_FILE_TYPES,
  ORDER_FORM_LIMITS,
} from "@/lib/orderForm/types";

// Issues a signed upload URL for one order form attachment. The browser then uploads the
// file straight to storage: a serverless function cannot accept a body over ~4.5 MB, and
// artwork files are often larger. The bucket enforces the size cap on the upload itself.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (await isRateLimited(`order-form-upload:${clientIp(req)}`, 40, 600)) {
    return NextResponse.json(
      { error: "Túl sok feltöltés. Kérjük, próbáld újra később." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    fileName?: unknown;
    size?: unknown;
  } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const size = typeof body?.size === "number" ? body.size : -1;

  const ext = fileExtension(fileName);
  if (!(ext in ORDER_FORM_FILE_TYPES)) {
    return NextResponse.json(
      { error: "Csak PNG, JPG, WebP, PDF, SVG, AI vagy EPS fájl tölthető fel." },
      { status: 400 }
    );
  }
  if (size <= 0 || size > ORDER_FORM_LIMITS.maxFileBytes) {
    return NextResponse.json(
      { error: "A fájl mérete legfeljebb 20 MB lehet." },
      { status: 400 }
    );
  }

  try {
    const upload = await createOrderFileUploadUrl(ext);
    return NextResponse.json(upload);
  } catch (err) {
    console.error("[order-form] upload URL failed:", err);
    return NextResponse.json(
      { error: "A feltöltés most nem sikerült. Kérjük, próbáld újra." },
      { status: 500 }
    );
  }
}
