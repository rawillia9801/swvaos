import { getCallerCrmProfile, logCallerEvent, normalizeCallerPhone } from "../../../../../db/caller-crm";
import { reserveTransportationMeet, transportationTimeSlots } from "../../../../../db/transportation-voice";
import { transportationConfirmedResponse, transportationTimeResponse, transportationUnavailableResponse } from "../../../../../lib/transportation-voice";
import { verifyVoiceSession } from "../../../../../lib/voice-session";
import { readVoiceForm, twilio, validateVoiceRequest, voiceError, voiceXml } from "../../../../../lib/voice-webhook";

export const runtime = "nodejs";

function restartTransportation(session: string, line: string) {
  const response = new twilio.twiml.VoiceResponse();
  const params = new URLSearchParams({ session });
  if (line) params.set("line", line);
  response.redirect(`/api/voice/transportation?${params.toString()}`);
  return response;
}

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("session") || "";
    const session = verifyVoiceSession(sessionToken);
    const phone = form.From || form.Caller || "";
    const line = form.To || form.Called || url.searchParams.get("line") || "";
    const callSid = form.CallSid || "";
    const date = url.searchParams.get("date") || "";

    if (!session || normalizeCallerPhone(session.phone) !== normalizeCallerPhone(phone) || (callSid && session.callSid !== "unknown-call" && session.callSid !== callSid)) {
      return voiceError("The verified voice session is missing or expired.", 403);
    }

    const profile = await getCallerCrmProfile(phone, undefined, session.buyerId);
    if (!profile.recognized || profile.buyer?.id !== session.buyerId) return voiceError("The verified family account no longer matches this call.", 403);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return voiceXml(restartTransportation(sessionToken, line));

    const digit = String(form.Digits || "").trim();
    if (digit === "9") return voiceXml(restartTransportation(sessionToken, line));
    const slots = transportationTimeSlots();
    const slot = slots[Number(digit) - 1];
    if (!slot) return voiceXml(transportationTimeResponse(date, sessionToken, line));

    const result = await reserveTransportationMeet({ buyerId: session.buyerId, date, time: slot, callSid });
    if (result.unavailable) return voiceXml(transportationUnavailableResponse(sessionToken, line, date));

    await logCallerEvent({
      phone,
      callSid,
      buyerId: session.buyerId,
      title: result.existing ? "Existing transportation reservation reviewed by phone" : "Transportation meeting requested by phone",
      status: "Requested",
      details: `Date: ${result.date}\nTime: ${result.time}\nProgram date blocked: Yes\nBreeder confirmation required: Yes`,
    }).catch(() => null);

    return voiceXml(transportationConfirmedResponse({ date: result.date, time: result.time, session: sessionToken, line, existing: result.existing }));
  } catch (error) {
    return voiceError(error instanceof Error ? error.message : "Unable to reserve the transportation meeting.", 500);
  }
}
