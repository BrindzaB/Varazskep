import { createClient } from "@supabase/supabase-js";

// Server-side Supabase admin client — uses the service role key.
// Never expose this to the browser; import only from server-side code
// (API routes, seed scripts, server actions).
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export const BUCKET_CLIPART = process.env.SUPABASE_STORAGE_BUCKET_CLIPART ?? "clipart";
export const BUCKET_DESIGNS = process.env.SUPABASE_STORAGE_BUCKET_DESIGNS ?? "designs";
