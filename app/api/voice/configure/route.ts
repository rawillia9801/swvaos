import twilio from "twilio";
import { requireAdminSession } from "../../../../lib/admin-session";
import { DEFAULT_MAIN_NUMBER, DEFAULT_PUP_LIFT_NUMBER } from "../../../../lib/caller-voice";

export const runtime = "nodejs";

function normalizePhone(value: unknown) {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return "";
}

export async function POST(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const configuredBase = process.env.TWILIO_WEBHOOK_BASE_URL?.trim().replace(/\/$/, "");
  const webhookBase = configuredBase === "https://swvaos.site" ? "https://www.swvaos.site" : configuredBase || "https://www.swvaos.site";
  if (!accountSid || !authToken) {
    return Response.json({ error: "Twilio credentials must be configured before syncing phone lines." }, { status: 503 });
  }

  const managedLines = [
    { id: "main", phone: normalizePhone(process.env.SWVAOS_MAIN_NUMBER || DEFAULT_MAIN_NUMBER), friendlyName: "Southwest Virginia Chihuahua" },
    { id: "pup-lift", phone: normalizePhone(process.env.SWVAOS_PUP_LIFT_NUMBER || DEFAULT_PUP_LIFT_NUMBER), friendlyName: "Pup-Lift Support" },
  ];

  try {
    const client = twilio(accountSid, authToken);
    const voiceUrl = `${webhookBase}/api/voice/incoming`;
    const results = await Promise.all(managedLines.map(async (line) => {
      const [record] = await client.incomingPhoneNumbers.list({ phoneNumber: line.phone, limit: 1 });
      if (!record) return { ...line, configured: false, error: "This number was not found in the configured Twilio account." };
      const updated = await client.incomingPhoneNumbers(record.sid).update({
        friendlyName: line.friendlyName,
        voiceUrl,
        voiceMethod: "POST",
      });
      return { ...line, sid: updated.sid, configured: updated.voiceUrl === voiceUrl, voiceUrl: updated.voiceUrl };
    }));
    const configured = results.every((line) => line.configured);
    return Response.json({ configured, voiceUrl, lines: results, messagingChanged: false }, { status: configured ? 200 : 207, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to configure the Twilio phone lines." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
