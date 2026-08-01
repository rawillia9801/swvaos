import { findPortalBuyerByEmail } from "../../../../../db/contracts";
import { sendPortalAccountSetupEmail } from "../../../../../lib/email-service";
import { createPortalToken } from "../../../../../lib/portal-token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let email = "";
  try {
    email = String((await request.json() as { email?: unknown }).email ?? "").trim().toLowerCase();
  } catch {
    return Response.json({ error: "Enter the email address used on your application or family account." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    const buyer = await findPortalBuyerByEmail(email);
    if (buyer) {
      const token = await createPortalToken(buyer.id, 30 / 1440);
      const setupLink = `${new URL(request.url).origin}/portal/setup?token=${encodeURIComponent(token)}`;
      const result = await sendPortalAccountSetupEmail({
        to: buyer.email,
        buyerId: buyer.id,
        firstName: buyer.firstName || buyer.name,
        setupLink,
        dedupeKey: `portal-account-setup-${Math.floor(Date.now() / 600_000)}`,
      });
      if (!result.sent && result.skipped !== "Already sent.") {
        return Response.json({ error: result.skipped || "Account setup email delivery is not available." }, { status: 503 });
      }
    }

    return Response.json({
      sent: true,
      message: "If that email matches an application or family account, a secure account-setup link is on its way.",
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to start Puppy Portal registration." }, { status: 500 });
  }
}
