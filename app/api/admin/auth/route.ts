import { NextRequest, NextResponse } from "next/server";
import { signAdminToken, COOKIE_NAME } from "@/lib/auth/jwt";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { username, password } = (await req.json()) as {
    username: string;
    password: string;
  };

  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword) {
    return NextResponse.json(
      { error: "Admin credentials are not configured" },
      { status: 500 },
    );
  }

  if (username !== validUsername || password !== validPassword) {
    return NextResponse.json(
      { error: "Hibás felhasználónév vagy jelszó" },
      { status: 401 },
    );
  }

  const token = await signAdminToken({ sub: username });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours in seconds
  });

  return response;
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
