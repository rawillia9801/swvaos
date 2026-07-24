import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from "./lib/admin-session";

const publicPath = (pathname: string) =>
  pathname === "/login"
  || pathname.startsWith("/api/auth/")
  || pathname.startsWith("/portal/")
  || pathname.startsWith("/api/portal/")
  || pathname.startsWith("/api/website/")
  || pathname.startsWith("/api/voice/")
  || pathname === "/api/caller-crm/lookup";

export function proxy(request: NextRequest) {
  if (publicPath(request.nextUrl.pathname)) return NextResponse.next();
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (isValidAdminSessionToken(token)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
