import { NextResponse } from "next/server";
import { findPortalBuyerByEmail } from "../../../../../db/contracts";
import { createPortalSession, PORTAL_SESSION_COOKIE } from "../../../../../lib/portal-session";
import { portalBuyerIdFromAuthUser, signInPortalPassword } from "../../../../../lib/supabase-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      return Response.json({ error: "Enter your email address and password." }, { status: 400 });
    }

    let user;
    try {
      user = await signInPortalPassword(email, password);
    } catch {
      return Response.json({ error: "The email address or password is incorrect." }, { status: 401 });
    }

    let buyerId = portalBuyerIdFromAuthUser(user);
    if (!buyerId) buyerId = (await findPortalBuyerByEmail(email))?.id ?? null;
    if (!buyerId) return Response.json({ error: "This account is not connected to a Puppy Portal family record." }, { status: 403 });

    const session = await createPortalSession(buyerId);
    const response = NextResponse.json({ ok: true, redirect: "/portal/account" });
    response.cookies.set({
      name: PORTAL_SESSION_COOKIE,
      value: session,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 86400,
    });
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to sign in to Puppy Portal." }, { status: 500 });
  }
}
