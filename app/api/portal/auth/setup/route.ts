import { NextResponse } from "next/server";
import { getPuppyPortalForBuyer } from "../../../../../db/contracts";
import { sendOwnerNotification } from "../../../../../lib/email-service";
import { createPortalSession, PORTAL_SESSION_COOKIE } from "../../../../../lib/portal-session";
import { verifyPortalToken } from "../../../../../lib/portal-token";
import { createOrUpdatePortalAuthUser } from "../../../../../lib/supabase-auth";

export const runtime = "nodejs";

function validPassword(value: string) {
  return value.length >= 10 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: unknown; password?: unknown; confirm_password?: unknown };
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    const confirmation = String(body.confirm_password ?? "");
    const claims = await verifyPortalToken(token);
    if (!claims) return Response.json({ error: "This account-setup link is invalid or has expired." }, { status: 400 });
    if (!validPassword(password)) return Response.json({ error: "Use at least 10 characters with an uppercase letter, lowercase letter, and number." }, { status: 400 });
    if (password !== confirmation) return Response.json({ error: "The passwords do not match." }, { status: 400 });

    const portal = await getPuppyPortalForBuyer(claims.buyerId);
    if (!portal?.buyer?.email) return Response.json({ error: "The family account could not be found." }, { status: 404 });

    await createOrUpdatePortalAuthUser({
      email: portal.buyer.email,
      password,
      buyerId: claims.buyerId,
      name: portal.buyer.name,
    });

    const session = await createPortalSession(claims.buyerId);
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

    try {
      await sendOwnerNotification({
        category: "General",
        subject: `Puppy Portal account activated for ${portal.buyer.name}`,
        buyerId: claims.buyerId,
        body: [
          "A family completed secure Puppy Portal account setup.",
          "",
          `Family: ${portal.buyer.name}`,
          `Email: ${portal.buyer.email}`,
          `Application status: ${portal.buyer.applicationStatus || "Not recorded"}`,
          "",
          "Their portal is now password protected and connected to the existing SWVAOS family record.",
        ].join("\n"),
      });
    } catch (emailError) {
      console.error("Owner portal-account notification failed", emailError instanceof Error ? emailError.message : emailError);
    }

    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create the Puppy Portal account." }, { status: 500 });
  }
}
