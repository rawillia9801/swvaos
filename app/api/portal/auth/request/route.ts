import { findPortalBuyerByEmail } from "../../../../../db/contracts";
import { sendTemplateEmail } from "../../../../../lib/email-service";
import { createPortalToken } from "../../../../../lib/portal-token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let email = "";
  try {
    email = String((await request.json() as { email?: unknown }).email ?? "").trim().toLowerCase();
  } catch {
    return Response.json({ error: "Enter the email address on your family account." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    const buyer = await findPortalBuyerByEmail(email);
    if (buyer) {
      const token = await createPortalToken(buyer.id, 20 / 1440);
      const accessLink = `${new URL(request.url).origin}/api/portal/auth/verify?token=${encodeURIComponent(token)}`;
      const result = await sendTemplateEmail({
        templateKey: "portal_sign_in",
        to: buyer.email,
        buyerId: buyer.id,
        dedupeKey: `portal-access-${Math.floor(Date.now() / 600_000)}`,
        variables: { first_name: buyer.firstName || buyer.name, buyer_name: buyer.name, access_link: accessLink, portal_url: accessLink },
      });
      if (!result.sent && result.skipped !== "Already sent.") return Response.json({ error: result.skipped || "Portal email delivery is not available." }, { status: 503 });
    }
    return Response.json({ sent: true, message: "If that email matches a family account, a secure sign-in link is on its way." }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to send a Puppy Portal sign-in link." }, { status: 500 });
  }
}
