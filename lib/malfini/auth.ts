// Malfini API authentication — module-level token cache with expiry.
// In serverless environments each cold start re-auths automatically (module
// variables reset per function instance), which is acceptable.

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

// Buffer subtracted from expires_in to refresh before actual expiry.
const EXPIRY_BUFFER_MS = 60 * 1000; // 1 minute

export async function getMalfiniToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  return fetchToken();
}

export function clearCachedToken(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

async function fetchToken(): Promise<string> {
  const baseUrl = process.env.MALFINI_API_URL;
  const username = process.env.MALFINI_USERNAME;
  const password = process.env.MALFINI_PASSWORD;

  if (!baseUrl || !username || !password) {
    throw new Error(
      "Malfini API credentials not configured. Set MALFINI_API_URL, MALFINI_USERNAME, MALFINI_PASSWORD in environment."
    );
  }

  const res = await fetch(`${baseUrl}/api/v4/api-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Malfini auth failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { access_token?: string; expires_in?: number };

  if (!data.access_token) {
    throw new Error("Malfini auth response did not contain access_token");
  }

  const ttlMs = data.expires_in
    ? data.expires_in * 1000 - EXPIRY_BUFFER_MS
    : 50 * 60 * 1000; // fallback: 50 min if expires_in absent

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + ttlMs;
  return data.access_token;
}
