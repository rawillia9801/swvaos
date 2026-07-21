import { NextResponse } from "next/server";
import { PORTAL_SESSION_COOKIE } from "../../../../../lib/portal-session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/portal/login", request.url), 303);
  response.cookies.set({ name: PORTAL_SESSION_COOKIE, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
