import { NextRequest, NextResponse } from "next/server";
import {
  createOrderFormOrder,
  getOrderFormCatalog,
  getUploadedOrderFiles,
} from "@/lib/services/orderForm";
import { validateOrderFormSubmission } from "@/lib/orderForm/validate";
import {
  sendOrderFormNotificationEmail,
  sendOrderFormReceivedEmail,
} from "@/lib/services/email";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

// Order form (megrendelő lap) submission. Creates an ORDER_FORM order in REQUESTED status
// — no price and no payment; the shop settles it with the customer afterwards. This is the
// one place orders are created outside the Stripe webhook.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (await isRateLimited(`order-form:${clientIp(req)}`, 5, 600)) {
    return NextResponse.json(
      { error: "Túl sok beküldés. Kérjük, próbáld újra később." },
      { status: 429 }
    );
  }

  const body: unknown = await req.json().catch(() => null);

  // Honeypot: the hidden "website" field is only ever filled by bots. Answer as if it
  // worked so the bot has nothing to learn, but store nothing.
  if (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { website?: unknown }).website === "string" &&
    (body as { website: string }).website !== ""
  ) {
    return NextResponse.json({ ok: true });
  }

  const catalog = await getOrderFormCatalog();
  const parsed = validateOrderFormSubmission(body, catalog);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const files = await getUploadedOrderFiles(parsed.value.attachments);
  if (!files) {
    return NextResponse.json(
      { error: "Egy csatolt fájl nem található. Kérjük, töltsd fel újra." },
      { status: 400 }
    );
  }

  let order;
  try {
    order = await createOrderFormOrder({ ...parsed.value, attachments: files });
  } catch (err) {
    console.error("[order-form] createOrderFormOrder failed:", err);
    return NextResponse.json(
      { error: "A megrendelést nem sikerült rögzíteni. Kérjük, próbáld újra." },
      { status: 500 }
    );
  }

  // Emails are best-effort — the order is already stored.
  const emailInput = {
    orderId: order.id,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone ?? "",
    note: order.customerNote ?? "",
    items: order.items,
    attachmentNames: order.attachments.map((a) => a.fileName),
  };
  const results = await Promise.allSettled([
    sendOrderFormReceivedEmail(emailInput),
    sendOrderFormNotificationEmail(emailInput),
  ]);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[order-form] email failed:", r.reason);
    }
  }

  return NextResponse.json({ ok: true });
}
