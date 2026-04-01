// Malfini API authentication — module-level token cache with expiry.
// In serverless environments each cold start re-auths automatically (module
// variables reset per function instance), which is acceptable.

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

// Conservative TTL — refreshed before actual expiry to avoid mid-request 401s.
// Adjust TOKEN_TTL_MS once the actual Malfini token lifetime is confirmed.
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutes

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

  const res = await fetch(`${baseUrl}/api/v4/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Malfini auth failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { token?: string; access_token?: string };
  const token = data.token ?? data.access_token;

  if (!token) {
    throw new Error("Malfini auth response did not contain a token");
  }

  cachedToken = token;
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  return token;
}
