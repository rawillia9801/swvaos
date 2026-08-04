import { getCallerCrmProfile, logCallerEvent, normalizeCallerPhone } from "../../../../db/caller-crm";
import { accountVoiceResponse, unavailableVoiceResponse } from "../../../../lib/caller-voice";
import { verifyVoiceSession } from "../../../../lib/voice-session";
import { readVoiceForm, validateVoiceRequest, voiceError, voiceXml } from "../../../../lib/voice-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await readVoiceForm(request);
  const validation = validateVoiceRequest(request, form);
  if (!validation.valid) return voiceError(validation.error, validation.status);

  try {
    const url = new URL(request.url);
    const sessionToken = url.searchParams.get("session") || "";
    const session = verifyVoiceSession(sessionToken);
    const phone = form.From || form.Caller || "";
    const calledNumber = form.To || form.Called || url.searchParams.get("line") || "";
    const callSid = form.CallSid || "";

    if (!session || normalizeCallerPhone(session.phone) !== normalizeCallerPhone(phone) || (session.callSid !== "unknown-call" && callSid && session.callSid !== callSid)) {
      await logCallerEvent({ phone, callSid, title: "Voice account session rejected", status: "Failed", details: "The secure voice session was missing, expired, or did not match the current call." }).catch(() => null);
      return voiceXml(unavailableVoiceResponse());
    }

    const profile = await getCallerCrmProfile(phone);
    if (!profile.recognized || profile.buyer?.id !== session.buyerId) {
      await logCallerEvent({ phone, callSid, buyerId: session.buyerId, title: "Voice account identity mismatch", status: "Failed", details: "The verified buyer no longer matched the calling number." }).catch(() => null);
      return voiceXml(unavailableVoiceResponse());
    }

    return voiceXml(accountVoiceResponse(profile, form.Digits || "", calledNumber, sessionToken));
  } catch {
    return voiceXml(unavailableVoiceResponse());
  }
}
