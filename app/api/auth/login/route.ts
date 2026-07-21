import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, isValidAdminPassword } from "../../../../lib/admin-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let password = "";
  try {
    password = String((await request.json() as { password?: unknown }).password ?? "");
  } catch {
    return Response.json({ error: "Enter the operating-system password." }, { status: 400 });
  }

  if (!isValidAdminPassword(password)) {
    return Response.json({ error: "That password is not correct." }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const token = createAdminSessionToken();
  if (!token) return Response.json({ error: "Session security is not configured." }, { status: 503 });

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
