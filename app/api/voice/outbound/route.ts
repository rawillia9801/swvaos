import twilio from "twilio";
import { logCallerEvent } from "../../../../db/caller-crm";
import { requireAdminSession } from "../../../../lib/admin-session";

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

  try {
    const body = await request.json() as { number?: unknown; operator?: unknown; buyerId?: unknown; label?: unknown };
    const destination = normalizePhone(body.number);
    if (!destination) return Response.json({ error: "Enter a valid phone number." }, { status: 400 });

    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const callerId = normalizePhone(process.env.SWVAOS_CALLER_ID);
    const webhookBase = process.env.TWILIO_WEBHOOK_BASE_URL?.trim().replace(/\/$/, "");
    const teamNumbers = (process.env.SWVAOS_CALL_TEAM_NUMBERS ?? "").split(",").map(normalizePhone).filter(Boolean);
    if (!accountSid || !authToken || !callerId || !webhookBase || !teamNumbers.length) {
      return Response.json({ error: "Twilio outbound calling is not fully configured." }, { status: 503 });
    }

    const operatorIndex = String(body.operator ?? "cristy").toLowerCase() === "robert" ? 1 : 0;
    const operatorPhone = teamNumbers[operatorIndex] || teamNumbers[0];
    const operatorName = operatorIndex === 1 ? "Robert" : "Cristy";
    const label = String(body.label ?? "").trim().slice(0, 120);
    const buyerId = Number(body.buyerId);
    const connectUrl = new URL("/api/voice/outbound/connect", webhookBase);
    connectUrl.searchParams.set("to", destination);

    const client = twilio(accountSid, authToken);
    const call = await client.calls.create({
      to: operatorPhone,
      from: callerId,
      url: connectUrl.toString(),
      method: "POST",
    });

    await logCallerEvent({
      phone: destination,
      callSid: call.sid,
      buyerId: Number.isInteger(buyerId) && buyerId > 0 ? buyerId : undefined,
      title: `Outbound call${label ? ` - ${label}` : ` - ${destination}`}`,
      status: "Initiated",
      details: `Operator: ${operatorName}\nDirection: Outbound`,
    }).catch(() => null);

    return Response.json({ callSid: call.sid, operator: operatorName, status: call.status || "queued" }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to start the outbound call." }, { status: 500 });
  }
}
