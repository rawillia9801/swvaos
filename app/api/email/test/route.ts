import { requireAdminSession } from "../../../../lib/admin-session";
import { sendTemplateEmail } from "../../../../lib/email-service";
import { defaultTemplatesConfig, type EmailTemplateKey } from "../../../../lib/template-defaults";

export async function POST(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { to?: unknown; templateKey?: unknown };
    const templateKey = String(body.templateKey ?? "application_received") as EmailTemplateKey;
    if (!(templateKey in defaultTemplatesConfig.emails)) return Response.json({ error: "Choose a valid email template." }, { status: 400 });
    const result = await sendTemplateEmail({
      templateKey,
      to: String(body.to ?? ""),
      variables: {
        first_name: "Test customer",
        buyer_name: "Test Customer",
        puppy_name: " for your puppy",
        amount: "$500.00",
        due_date: "August 1, 2026",
        portal_url: new URL(request.url).origin,
        access_link: `${new URL(request.url).origin}/portal/login`,
        update_title: "A test puppy update",
      },
    });
    if (!result.sent) return Response.json({ error: result.skipped || "The test email was not sent." }, { status: 400 });
    return Response.json({ sent: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to send the test email." }, { status: 500 });
  }
}
