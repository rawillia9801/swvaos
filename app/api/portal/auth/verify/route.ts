import { NextResponse } from "next/server";
import { createPortalSession, PORTAL_SESSION_COOKIE } from "../../../../../lib/portal-session";
import { verifyPortalToken } from "../../../../../lib/portal-token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const claims = await verifyPortalToken(token);
  if (!claims) return NextResponse.redirect(new URL("/portal/login?error=expired", request.url));
  const session = await createPortalSession(claims.buyerId);
  const response = NextResponse.redirect(new URL("/portal/account", request.url));
  response.cookies.set({ name: PORTAL_SESSION_COOKIE, value: session, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  return response;
}
