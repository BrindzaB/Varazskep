import { NextRequest, NextResponse } from "next/server";
import { warmupMalfiniCache } from "@/lib/malfini/client";

export async function GET(request: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> automatically.
  // In local dev CRON_SECRET is undefined — skip the check.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Unconditionally fetches fresh data from Malfini and writes to both
  // the module-level L1 cache and the shared Redis L2 cache.
  await warmupMalfiniCache("hu");
  return NextResponse.json({ ok: true, warmedAt: new Date().toISOString() });
}
