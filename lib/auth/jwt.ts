import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "admin_token";
const EXPIRY = "24h";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return new TextEncoder().encode(secret);
}

export interface AdminTokenPayload {
  sub: string; // username
}

export async function signAdminToken(payload: AdminTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { sub: payload.sub as string };
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
