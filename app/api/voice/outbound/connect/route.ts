import { readVoiceForm, twilio, validateVoiceRequest, voiceError, voiceXml } from "../../../../../lib/voice-webhook";

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
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  const destination = normalizePhone(new URL(request.url).searchParams.get("to"));
  const callerId = normalizePhone(process.env.SWVAOS_CALLER_ID);
  if (!destination || !callerId) return voiceError("Outbound call routing is not configured.", 503);

  const response = new twilio.twiml.VoiceResponse();
  response.say({ voice: "alice" }, "SWVAOS outbound call. Connecting you now.");
  const dial = response.dial({ callerId, answerOnBridge: true, timeout: 35 });
  dial.number(destination);
  response.say({ voice: "alice" }, "The call could not be completed.");
  return voiceXml(response);
}
